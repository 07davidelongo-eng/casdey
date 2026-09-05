import { siteUrl } from "../messaging";
import type { Interval } from "./availability";

/**
 * The redirect URI Google is told about, and the only one it will accept.
 *
 * Built from the canonical site URL rather than from the incoming request's
 * origin. Those are not the same thing: casdey.com answers on both the apex
 * and `www`, and in production the apex 308s to `www`, so a visitor is
 * always on the host that is *not* in NEXT_PUBLIC_SITE_URL and was never
 * whitelisted in Google Cloud. Deriving the URI from the request meant every
 * production attempt to connect a calendar died on Google's
 * `Error 400: redirect_uri_mismatch` before the gym saw a consent screen.
 *
 * A redirect URI has to match a fixed string on Google's side exactly, so it
 * must come from fixed configuration, never from whatever hostname the
 * browser happened to use.
 */
export function calendarRedirectUri(): string {
  return `${siteUrl()}/api/calendar/google/callback`;
}

/**
 * The domain to pin the OAuth state cookie to, or undefined to leave it
 * host-only.
 *
 * Consent starts on whichever host the gym is browsing and comes back on the
 * canonical one, so a host-only cookie would not be sent back and every
 * connection would fail the state check instead. Pinning it to the
 * registrable domain covers both. Undefined on localhost, where a domain
 * attribute buys nothing and browsers treat it inconsistently.
 */
export function calendarStateCookieDomain(): string | undefined {
  const host = new URL(siteUrl()).hostname;
  if (host === "localhost" || /^[\d.]+$/.test(host)) return undefined;
  return host.replace(/^www\./, "");
}

/**
 * The one place that talks to Google Calendar.
 *
 * Raw fetch, no `googleapis` SDK, the same choice already made for Resend
 * (../messaging.ts): the handful of endpoints booking needs are smaller to
 * hand-roll than the whole SDK is to carry.
 *
 * Scopes requested are the narrowest that work: `calendar.app.created` lets
 * casdey create and manage only the events it creates itself (not read, edit or
 * delete the owner's other events, which `calendar.events` would have allowed),
 * plus `calendar.freebusy` to read busy times, plus openid+email so the gym can
 * see which Google account is connected. Not full `calendar` access, and not
 * even `calendar.events`: a booking tool never needs to touch an event it did
 * not make. This narrower request is also easier to pass Google's OAuth
 * verification with.
 *
 * The pure, network-free helpers (`buildConsentUrl`, `parseFreeBusy`) are
 * exported and unit tested; everything that actually calls Google is async and
 * exercised in integration testing once a real OAuth client exists.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export type GoogleOAuthConfig = { clientId: string; clientSecret: string };

export function googleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Calendar is not configured: set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET",
    );
  }
  return { clientId, clientSecret };
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  );
}

/**
 * The consent-screen URL. `access_type=offline` + `prompt=consent` are what
 * make Google return a refresh token (and return one again on reconnect),
 * without which casdey could not write to the calendar after the first hour.
 */
export function buildConsentUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type GoogleTokens = {
  accessToken: string;
  /** Absent on a refresh; Google only returns it on the first consent. */
  refreshToken: string | null;
  expiresAt: Date;
  /** From the id_token, when openid+email were granted. */
  email: string | null;
};

/** Decodes the email claim out of an id_token without verifying it (we only
 *  ever use it to display which account connected, never for trust). */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

async function tokenRequest(body: URLSearchParams): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google token request failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  return response.json();
}

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleOAuthConfig();
  const json = await tokenRequest(
    new URLSearchParams({
      code: opts.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }),
  );
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
    email: emailFromIdToken(json.id_token),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleOAuthConfig();
  const json = await tokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  );
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
    email: emailFromIdToken(json.id_token),
  };
}

/**
 * The name of the calendar casdey creates in the gym's Google account.
 *
 * It has to create one. Under `calendar.app.created` the gym's own
 * `primary` calendar is not visible at all (events.insert answers 404, not
 * 403), so there is nowhere else casdey is allowed to put a booking. The gym
 * sees this as an extra calendar in their sidebar, which they can hide, share
 * or delete, and casdey can never reach anything outside it.
 */
export const CASDEY_CALENDAR_SUMMARY = "casdey bookings";

/**
 * Creates that calendar and returns its id. Called once, when a gym connects.
 */
export async function createAppCalendar(opts: {
  accessToken: string;
  timeZone?: string | null;
}): Promise<{ calendarId: string }> {
  const response = await fetch(`${CALENDAR_API}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: CASDEY_CALENDAR_SUMMARY,
      description:
        "Bookings made through casdey. casdey can only see and change events on this calendar.",
      ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Google calendars.insert failed: ${response.status} ${detail.slice(0, 200)}`,
    );
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error("Google created the calendar but returned no id");
  }
  return { calendarId: json.id };
}

/**
 * Turns a freebusy.query response into the busy intervals openSlots wants.
 *
 * Takes every calendar asked about and merges them, because a gym is busy if
 * *any* of their calendars says so. openSlots does not care which one.
 */
export function parseFreeBusy(
  json: unknown,
  calendarIds: string | string[],
): Interval[] {
  const calendars = (json as { calendars?: Record<string, { busy?: { start: string; end: string }[] }> })
    ?.calendars;
  const ids = Array.isArray(calendarIds) ? calendarIds : [calendarIds];
  return ids
    .flatMap((id) => calendars?.[id]?.busy ?? [])
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function queryFreeBusy(opts: {
  accessToken: string;
  calendarId: string | string[];
  timeMin: Date;
  timeMax: Date;
}): Promise<Interval[]> {
  const response = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: opts.timeMin.toISOString(),
      timeMax: opts.timeMax.toISOString(),
      items: (Array.isArray(opts.calendarId)
        ? opts.calendarId
        : [opts.calendarId]
      ).map((id) => ({ id })),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google freeBusy failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  return parseFreeBusy(await response.json(), opts.calendarId);
}

export async function insertEvent(opts: {
  accessToken: string;
  calendarId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmail?: string | null;
}): Promise<{ eventId: string }> {
  const body: Record<string, unknown> = {
    summary: opts.summary,
    description: opts.description,
    start: { dateTime: opts.start.toISOString() },
    end: { dateTime: opts.end.toISOString() },
  };
  if (opts.attendeeEmail) {
    body.attendees = [{ email: opts.attendeeEmail }];
  }

  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(opts.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google events.insert failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) throw new Error("Google accepted the event but returned no id");
  return { eventId: json.id };
}

/** Best-effort revocation of a token at Google, so disconnecting actually
 *  severs access rather than just forgetting the token locally. */
export async function revokeToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  }).catch(() => {
    // A revoke that fails (already-revoked, network) must not block disconnect;
    // the local token is deleted regardless.
  });
}

export async function deleteEvent(opts: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(opts.calendarId)}/events/${encodeURIComponent(opts.eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    },
  );
  // 410 Gone means it was already deleted, which is fine for our purposes.
  if (!response.ok && response.status !== 410 && response.status !== 404) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google events.delete failed: ${response.status} ${detail.slice(0, 200)}`);
  }
}
