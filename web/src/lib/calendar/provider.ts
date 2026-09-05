import "server-only";

import { supabaseAdmin } from "../supabase";
import type { CalendarConnection } from "../types";
import type { Interval } from "./availability";
import {
  createAppCalendar,
  deleteEvent as googleDeleteEvent,
  insertEvent as googleInsertEvent,
  queryFreeBusy,
  refreshAccessToken,
} from "./google";
import { decryptToken, encryptToken } from "./tokens";

/**
 * The calendar the app actually books against, hiding token refresh.
 *
 * Mirrors emailProvider(): `calendarFor(gymId)` returns
 * a live handle when a gym has connected Google, or null when it has not,
 * so callers branch on presence instead of scattering "is it connected" checks.
 *
 * Access tokens expire in an hour; the refresh token does not. This module is
 * the one place that swaps an expired access token for a fresh one and writes
 * the new (encrypted) token back, so no route ever has to think about it.
 */

export type ConnectedCalendar = {
  calendarId: string;
  connectedEmail: string | null;
  getBusy(timeMin: Date, timeMax: Date): Promise<Interval[]>;
  createEvent(opts: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendeeEmail?: string | null;
  }): Promise<{ eventId: string }>;
  deleteEvent(eventId: string): Promise<void>;
};

/** The full row including encrypted tokens. Server-side only, never to a page. */
async function loadConnection(
  gymId: string,
): Promise<CalendarConnection | null> {
  const { data } = await supabaseAdmin()
    .from("calendar_connections")
    .select("*")
    .eq("gym_id", gymId)
    .maybeSingle();
  return (data as CalendarConnection) ?? null;
}

/** Google returns `invalid_grant` when a refresh token is no longer usable.
 *  The thrown error carries the raw token-endpoint body, so a substring match
 *  is enough and avoids coupling to Google's exact error shape. */
function isInvalidGrant(error: unknown): boolean {
  return error instanceof Error && error.message.includes("invalid_grant");
}

/** A non-expired access token for the connection, refreshing and persisting a
 *  new one when the stored token is within a minute of expiry. */
async function validAccessToken(connection: CalendarConnection): Promise<string> {
  const soon = Date.now() + 60_000;
  const notExpired =
    connection.token_expires_at &&
    new Date(connection.token_expires_at).getTime() > soon;

  if (notExpired && connection.access_token_enc) {
    return decryptToken(connection.access_token_enc);
  }

  if (!connection.refresh_token_enc) {
    throw new Error("Calendar connection has no refresh token; reconnect needed.");
  }

  let refreshed;
  try {
    refreshed = await refreshAccessToken(
      decryptToken(connection.refresh_token_enc),
    );
  } catch (error) {
    // A dead refresh token (the user revoked casdey's access at Google, or the
    // OAuth app is still unverified and Google expired the token after 7 days)
    // comes back as invalid_grant. Mark the connection so Settings prompts a
    // reconnect, then rethrow: the caller must fail closed, never proceed as
    // though the calendar were readable.
    if (isInvalidGrant(error)) {
      await supabaseAdmin()
        .from("calendar_connections")
        .update({ status: "revoked" })
        .eq("id", connection.id);
    }
    throw error;
  }

  await supabaseAdmin()
    .from("calendar_connections")
    .update({
      access_token_enc: encryptToken(refreshed.accessToken),
      token_expires_at: refreshed.expiresAt.toISOString(),
      // Google occasionally rotates the refresh token; keep the new one if so.
      ...(refreshed.refreshToken
        ? { refresh_token_enc: encryptToken(refreshed.refreshToken) }
        : {}),
    })
    .eq("id", connection.id);

  return refreshed.accessToken;
}

export async function calendarFor(
  gymId: string,
): Promise<ConnectedCalendar | null> {
  const connection = await loadConnection(gymId);
  if (
    !connection ||
    connection.status !== "active" ||
    !connection.refresh_token_enc
  ) {
    return null;
  }

  // Two different calendars, and conflating them is what broke booking in
  // production: casdey READS busy times from the gym's own diary (normally
  // "primary") and WRITES bookings into a calendar it created itself, because
  // the calendar.app.created scope cannot see any other one.
  const readId = connection.google_calendar_id;

  return {
    calendarId: readId,
    connectedEmail: connection.connected_email,
    async getBusy(timeMin, timeMax) {
      const writeId = connection.google_write_calendar_id;
      return queryFreeBusy({
        accessToken: await validAccessToken(connection),
        // Both, so a slot casdey booked is busy even before the gym's own
        // diary knows about it. Duplicates are harmless; openSlots merges.
        calendarId: writeId && writeId !== readId ? [readId, writeId] : readId,
        timeMin,
        timeMax,
      });
    },
    async createEvent(opts) {
      const accessToken = await validAccessToken(connection);
      return googleInsertEvent({
        accessToken,
        calendarId: await writeCalendarId(connection, accessToken),
        ...opts,
      });
    },
    async deleteEvent(eventId) {
      const accessToken = await validAccessToken(connection);
      return googleDeleteEvent({
        accessToken,
        calendarId: await writeCalendarId(connection, accessToken),
        eventId,
      });
    },
  };
}

/**
 * The calendar casdey writes into, creating it if this connection predates
 * having one.
 *
 * Provisioned lazily rather than only at connect time so a gym that connected
 * earlier is repaired the first time it books, instead of being told to go
 * and reconnect for a reason it cannot see. Stored straight away, so this
 * costs one extra Google call once per connection and never again.
 */
async function writeCalendarId(
  connection: CalendarConnection,
  accessToken: string,
): Promise<string> {
  const existing = connection.google_write_calendar_id;
  // "primary" is not a usable write target under the app-created scope, so an
  // old row carrying it is treated as unprovisioned rather than trusted.
  if (existing && existing !== "primary") return existing;

  const { calendarId } = await createAppCalendar({ accessToken });

  await supabaseAdmin()
    .from("calendar_connections")
    .update({ google_write_calendar_id: calendarId })
    .eq("id", connection.id);

  // Keep the in-memory row in step, so two bookings in one request do not
  // create two calendars.
  connection.google_write_calendar_id = calendarId;

  return calendarId;
}

/** The non-secret view of a gym's connection, safe to render in Settings. */
export type CalendarConnectionView = {
  connected: boolean;
  email: string | null;
  calendarId: string | null;
  /** A calendar was connected but its token has since gone dead (see
   *  isInvalidGrant). The gym needs to reconnect; booking fails closed until
   *  they do. A clean disconnect deletes the row, so this is only ever true
   *  after a token death, never after a deliberate disconnect. */
  needsReauth: boolean;
};

export async function calendarConnectionView(
  gymId: string,
): Promise<CalendarConnectionView> {
  const connection = await loadConnection(gymId);
  const connected =
    Boolean(connection) &&
    connection!.status === "active" &&
    Boolean(connection!.refresh_token_enc);
  return {
    connected,
    email: connection?.connected_email ?? null,
    calendarId: connection?.google_calendar_id ?? null,
    needsReauth: Boolean(connection) && connection!.status === "revoked",
  };
}

/** Whether a gym relies on an external calendar that cannot currently be read
 *  (connected-but-dead). booking must fail closed in this case rather than
 *  silently offer slots it could not check against the real diary. A gym that
 *  never connected returns false: casdey's own bookings are then the whole
 *  truth and there is nothing to fail closed against. */
export async function calendarNeedsReauth(gymId: string): Promise<boolean> {
  const connection = await loadConnection(gymId);
  return Boolean(connection) && connection!.status === "revoked";
}
