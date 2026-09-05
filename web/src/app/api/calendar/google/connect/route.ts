import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import {
  buildConsentUrl,
  calendarRedirectUri,
  calendarStateCookieDomain,
  googleOAuthConfig,
  isGoogleCalendarConfigured,
} from "@/lib/calendar/google";
import { isCalendarKeyConfigured } from "@/lib/calendar/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "casdey_gcal_state";

/**
 * Starts the Google Calendar connect flow.
 *
 * Owner-only. A random state is set in an HttpOnly cookie and echoed back on the
 * consent URL; the callback checks they match, which is the CSRF guard. The
 * redirect target must be registered on the Google OAuth client, so it is built
 * from this request's own origin (localhost in dev, casdey.com in prod).
 */
export async function GET(request: NextRequest): Promise<Response> {
  await requireOwner();

  const origin = request.nextUrl.origin;
  const settings = new URL("/app/settings/booking", origin);

  if (!isGoogleCalendarConfigured() || !isCalendarKeyConfigured()) {
    settings.searchParams.set(
      "error",
      "Calendar connection is not configured on this server yet.",
    );
    return NextResponse.redirect(settings, 303);
  }

  const state = randomBytes(16).toString("hex");
  const url = buildConsentUrl({
    clientId: googleOAuthConfig().clientId,
    redirectUri: calendarRedirectUri(),
    state,
  });

  const response = NextResponse.redirect(url, 303);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    // Set on the registrable domain, because consent starts on whichever host
    // the gym is browsing and Google returns to the canonical one.
    domain: calendarStateCookieDomain(),
    maxAge: 600, // ten minutes to complete consent
  });
  return response;
}
