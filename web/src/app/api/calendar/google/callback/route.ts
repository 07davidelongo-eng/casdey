import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import {
  calendarRedirectUri,
  createAppCalendar,
  exchangeCode,
} from "@/lib/calendar/google";
import { encryptToken } from "@/lib/calendar/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "casdey_gcal_state";

/**
 * Where Google sends the browser back after the gym grants access.
 *
 * Re-authenticates the owner (so a stray callback cannot attach a calendar to
 * someone else's gym), checks the state cookie set in ./connect, then
 * exchanges the code for tokens and stores them encrypted. Google only returns
 * a refresh token when prompted with `prompt=consent` (which ./connect sets),
 * so a missing one is treated as a failure to reconnect rather than silently
 * storing a connection that will stop working in an hour.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { gym, session } = await requireOwner();
  const origin = request.nextUrl.origin;
  const back = new URL("/app/settings/booking", origin);

  const params = request.nextUrl.searchParams;

  const providerError = params.get("error");
  if (providerError) {
    back.searchParams.set(
      "error",
      providerError === "access_denied"
        ? "Calendar access was declined."
        : "Google could not complete the connection.",
    );
    return clearStateAndRedirect(back);
  }

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const state = params.get("state");
  if (!expectedState || !state || state !== expectedState) {
    back.searchParams.set("error", "That connection link expired. Try again.");
    return clearStateAndRedirect(back);
  }

  const code = params.get("code");
  if (!code) {
    back.searchParams.set("error", "Google did not return an authorisation code.");
    return clearStateAndRedirect(back);
  }

  try {
    const tokens = await exchangeCode({
      code,
      // Must be byte-identical to the one sent to the consent screen, or
      // Google rejects the exchange.
      redirectUri: calendarRedirectUri(),
    });

    if (!tokens.refreshToken) {
      back.searchParams.set(
        "error",
        "Google did not return a lasting connection. Disconnect any old casdey access in your Google account, then try again.",
      );
      return clearStateAndRedirect(back);
    }

    // The calendar casdey will write bookings into. It has to make its own:
    // under the calendar.app.created scope the gym's "primary" calendar is not
    // visible at all, so there is nowhere else a booking is allowed to go.
    // Best-effort here rather than fatal, because a connection that can still
    // read free/busy is worth keeping, and the write calendar is provisioned
    // again on first use if this call failed.
    let writeCalendarId: string | null = null;
    try {
      writeCalendarId = (await createAppCalendar({
        accessToken: tokens.accessToken,
      })).calendarId;
    } catch (calendarError) {
      console.error(
        "[calendar] could not create the casdey calendar",
        calendarError instanceof Error ? calendarError.message : calendarError,
      );
    }

    // Upsert: reconnecting replaces the old tokens rather than erroring on the
    // one-connection-per-gym unique constraint.
    const { error } = await supabaseAdmin()
      .from("calendar_connections")
      .upsert(
        {
          gym_id: gym.id,
          provider: "google",
          google_calendar_id: "primary",
          google_write_calendar_id: writeCalendarId,
          access_token_enc: encryptToken(tokens.accessToken),
          refresh_token_enc: encryptToken(tokens.refreshToken),
          token_expires_at: tokens.expiresAt.toISOString(),
          connected_email: tokens.email,
          status: "active",
        },
        { onConflict: "gym_id" },
      );

    if (error) {
      console.error("[calendar] store connection failed", error.message);
      back.searchParams.set("error", "We could not save the connection. Try again.");
      return clearStateAndRedirect(back);
    }

    await recordAudit({
      gymId: gym.id,
      actorId: session.userId,
      actorEmail: session.email,
      action: "calendar.connected",
      meta: { provider: "google", email: tokens.email },
    });

    back.searchParams.set("connected", "1");
    return clearStateAndRedirect(back);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[calendar] callback failed", detail);
    back.searchParams.set("error", "We could not complete the connection. Try again.");
    return clearStateAndRedirect(back);
  }
}

function clearStateAndRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url, 303);
  response.cookies.delete(STATE_COOKIE);
  return response;
}
