import { afterEach, describe, expect, it } from "vitest";

import {
  buildConsentUrl,
  calendarRedirectUri,
  calendarStateCookieDomain,
  parseFreeBusy,
  GOOGLE_CALENDAR_SCOPES,
} from "./google";

describe("buildConsentUrl", () => {
  const url = buildConsentUrl({
    clientId: "client-abc.apps.googleusercontent.com",
    redirectUri: "https://casdey.com/api/calendar/google/callback",
    state: "state-token-123",
  });
  const parsed = new URL(url);

  it("points at Google's consent endpoint", () => {
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
  });

  it("requests offline access and forces consent so a refresh token comes back", () => {
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
  });

  it("carries the state and redirect through", () => {
    expect(parsed.searchParams.get("state")).toBe("state-token-123");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://casdey.com/api/calendar/google/callback",
    );
  });

  it("asks only for app-created events and free/busy, not full or broad access", () => {
    const scope = parsed.searchParams.get("scope") ?? "";
    expect(scope).toContain("calendar.app.created");
    expect(scope).toContain("calendar.freebusy");
    // Never the broad edit-all-events scope, nor full calendar access.
    expect(scope).not.toContain("calendar.events");
    expect(scope).not.toContain("auth/calendar ");
    expect(GOOGLE_CALENDAR_SCOPES).toContain("email");
  });
});

describe("parseFreeBusy", () => {
  it("extracts busy intervals for the requested calendar", () => {
    const busy = parseFreeBusy(
      {
        calendars: {
          primary: {
            busy: [
              { start: "2026-08-17T09:00:00Z", end: "2026-08-17T09:30:00Z" },
              { start: "2026-08-17T12:00:00Z", end: "2026-08-17T13:00:00Z" },
            ],
          },
        },
      },
      "primary",
    );
    expect(busy).toHaveLength(2);
    expect(busy[0].start.toISOString()).toBe("2026-08-17T09:00:00.000Z");
    expect(busy[1].end.toISOString()).toBe("2026-08-17T13:00:00.000Z");
  });

  it("returns nothing for a calendar with no busy blocks or a malformed payload", () => {
    expect(parseFreeBusy({ calendars: { primary: {} } }, "primary")).toEqual([]);
    expect(parseFreeBusy({}, "primary")).toEqual([]);
    expect(parseFreeBusy(null, "primary")).toEqual([]);
  });
});

describe("calendarRedirectUri", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("comes from the configured site URL, not from whoever is asking", () => {
    // The bug this exists to prevent: production serves on www.casdey.com
    // while NEXT_PUBLIC_SITE_URL and the Google whitelist both say the apex,
    // so a request-derived URI produced redirect_uri_mismatch every time.
    process.env.NEXT_PUBLIC_SITE_URL = "https://casdey.com";
    expect(calendarRedirectUri()).toBe(
      "https://casdey.com/api/calendar/google/callback",
    );
  });

  it("ignores a trailing slash on the configured URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://casdey.com/";
    expect(calendarRedirectUri()).toBe(
      "https://casdey.com/api/calendar/google/callback",
    );
  });
});

describe("calendarStateCookieDomain", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("covers the apex and www with one cookie", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://casdey.com";
    expect(calendarStateCookieDomain()).toBe("casdey.com");
  });

  it("drops a www prefix, so consent on either host comes back to the same cookie", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.casdey.com";
    expect(calendarStateCookieDomain()).toBe("casdey.com");
  });

  it("stays host-only on localhost", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(calendarStateCookieDomain()).toBeUndefined();
  });
});
