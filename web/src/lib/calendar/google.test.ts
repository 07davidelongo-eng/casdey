import { describe, expect, it } from "vitest";

import { buildConsentUrl, parseFreeBusy, GOOGLE_CALENDAR_SCOPES } from "./google";

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

  it("asks for the calendar scopes, not full access", () => {
    const scope = parsed.searchParams.get("scope") ?? "";
    expect(scope).toContain("calendar.events");
    expect(scope).toContain("calendar.freebusy");
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
