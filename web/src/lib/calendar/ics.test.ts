import { describe, expect, it } from "vitest";

import { buildIcs } from "./ics";

const base = {
  uid: "appt-123",
  start: new Date("2026-08-17T09:00:00.000Z"),
  end: new Date("2026-08-17T09:30:00.000Z"),
  summary: "Appointment with Bridge Street Dental",
  stamp: new Date("2026-08-15T12:00:00.000Z"),
};

describe("buildIcs", () => {
  it("emits a well-formed single-event calendar", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:appt-123");
    expect(ics).toContain("DTSTART:20260817T090000Z");
    expect(ics).toContain("DTEND:20260817T093000Z");
    expect(ics).toContain("DTSTAMP:20260815T120000Z");
    expect(ics).toContain("END:VEVENT");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("uses CRLF line endings", () => {
    expect(buildIcs(base).includes("\r\n")).toBe(true);
  });

  it("escapes commas, semicolons, backslashes and newlines", () => {
    const ics = buildIcs({
      ...base,
      summary: "Check-up; cleaning, and x-ray",
      description: "Line one\nLine two\\end",
    });
    expect(ics).toContain("SUMMARY:Check-up\\; cleaning\\, and x-ray");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\\\\end");
  });

  it("omits optional fields when absent", () => {
    const ics = buildIcs(base);
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("folds long lines at the 75-octet limit", () => {
    const ics = buildIcs({ ...base, summary: "x".repeat(200) });
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});
