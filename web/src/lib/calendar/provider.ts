import "server-only";

import { supabaseAdmin } from "../supabase";
import type { CalendarConnection } from "../types";
import type { Interval } from "./availability";
import {
  deleteEvent as googleDeleteEvent,
  insertEvent as googleInsertEvent,
  queryFreeBusy,
  refreshAccessToken,
} from "./google";
import { decryptToken, encryptToken } from "./tokens";

/**
 * The calendar the app actually books against, hiding token refresh.
 *
 * Mirrors emailProvider()/whatsappProvider(): `calendarFor(practiceId)` returns
 * a live handle when a practice has connected Google, or null when it has not,
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
  practiceId: string,
): Promise<CalendarConnection | null> {
  const { data } = await supabaseAdmin()
    .from("calendar_connections")
    .select("*")
    .eq("practice_id", practiceId)
    .maybeSingle();
  return (data as CalendarConnection) ?? null;
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

  const refreshed = await refreshAccessToken(
    decryptToken(connection.refresh_token_enc),
  );

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
  practiceId: string,
): Promise<ConnectedCalendar | null> {
  const connection = await loadConnection(practiceId);
  if (
    !connection ||
    connection.status !== "active" ||
    !connection.refresh_token_enc
  ) {
    return null;
  }

  const calendarId = connection.google_calendar_id;

  return {
    calendarId,
    connectedEmail: connection.connected_email,
    async getBusy(timeMin, timeMax) {
      return queryFreeBusy({
        accessToken: await validAccessToken(connection),
        calendarId,
        timeMin,
        timeMax,
      });
    },
    async createEvent(opts) {
      return googleInsertEvent({
        accessToken: await validAccessToken(connection),
        calendarId,
        ...opts,
      });
    },
    async deleteEvent(eventId) {
      return googleDeleteEvent({
        accessToken: await validAccessToken(connection),
        calendarId,
        eventId,
      });
    },
  };
}

/** The non-secret view of a practice's connection, safe to render in Settings. */
export type CalendarConnectionView = {
  connected: boolean;
  email: string | null;
  calendarId: string | null;
};

export async function calendarConnectionView(
  practiceId: string,
): Promise<CalendarConnectionView> {
  const connection = await loadConnection(practiceId);
  const connected =
    Boolean(connection) &&
    connection!.status === "active" &&
    Boolean(connection!.refresh_token_enc);
  return {
    connected,
    email: connection?.connected_email ?? null,
    calendarId: connection?.google_calendar_id ?? null,
  };
}
