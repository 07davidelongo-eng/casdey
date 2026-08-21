import { describe, expect, it } from "vitest";

import {
  applyLapseFilter,
  lapseCutoff,
  isContactable,
  isLapsed,
  monthsSince,
  type LapseRule,
} from "./lapse";
import type { Member } from "./types";

const RULE: LapseRule = { lapsedAfterMonths: 12, maxVisits: 2 };
const NOW = new Date("2026-08-13T10:00:00Z");

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: "p1",
    gym_id: "pr1",
    external_ref: null,
    first_name: "Jane",
    last_name: "Okafor",
    email: "jane@example.com",
    phone: null,
    last_visit_at: "2024-01-05",
    visit_count: 2,
    status: "active",
    contacted_at: null,
    returned_at: null,
    consent_email: true,
    source: "csv",
    is_test: false,
    booking_token: "tok-p1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("lapseCutoff", () => {
  it("goes back the configured number of months", () => {
    expect(lapseCutoff(RULE, NOW)).toBe("2025-08-13");
  });

  it("crosses a year boundary", () => {
    const now = new Date("2026-02-10T00:00:00Z");
    expect(lapseCutoff({ ...RULE, lapsedAfterMonths: 3 }, now)).toBe(
      "2025-11-10",
    );
  });

  it("clamps rather than rolling into the next month", () => {
    // One month before 31 March is 28 February, not 3 March. JavaScript's own
    // date maths gets this wrong, which is why the function does it by hand.
    const now = new Date("2026-03-31T00:00:00Z");
    expect(lapseCutoff({ ...RULE, lapsedAfterMonths: 1 }, now)).toBe(
      "2026-02-28",
    );
  });

  it("keeps 29 February when the target year is a leap year", () => {
    const now = new Date("2025-03-29T00:00:00Z");
    expect(lapseCutoff({ ...RULE, lapsedAfterMonths: 13 }, now)).toBe(
      "2024-02-29",
    );
  });
});

describe("isLapsed", () => {
  it("catches a member who came twice and stopped", () => {
    expect(isLapsed(member(), RULE, NOW)).toBe(true);
  });

  it("ignores someone who came back recently", () => {
    expect(isLapsed(member({ last_visit_at: "2026-06-01" }), RULE, NOW)).toBe(
      false,
    );
  });

  it("ignores a regular, however long ago they last came", () => {
    // Nine visits is a loyal member having a gap, not a drop-off.
    expect(
      isLapsed(member({ visit_count: 9, last_visit_at: "2020-01-01" }), RULE, NOW),
    ).toBe(false);
  });

  it("treats the cutoff date itself as lapsed", () => {
    expect(
      isLapsed(member({ last_visit_at: lapseCutoff(RULE, NOW) }), RULE, NOW),
    ).toBe(true);
  });

  it("treats the day after the cutoff as not lapsed", () => {
    expect(isLapsed(member({ last_visit_at: "2025-08-14" }), RULE, NOW)).toBe(
      false,
    );
  });

  it("never counts someone who opted out", () => {
    expect(
      isLapsed(member({ status: "opted_out" }), RULE, NOW),
    ).toBe(false);
  });

  it("still counts someone already contacted, so a campaign can follow up", () => {
    expect(isLapsed(member({ status: "contacted" }), RULE, NOW)).toBe(true);
  });

  it("ignores a member with no visit on record", () => {
    expect(isLapsed(member({ last_visit_at: null }), RULE, NOW)).toBe(false);
  });

  it("follows the gym's own window", () => {
    const wide: LapseRule = { lapsedAfterMonths: 24, maxVisits: 2 };
    // Away 19 months: lapsed under a 12-month window, not under a 24-month one.
    const away19 = member({ last_visit_at: "2025-01-13" });
    expect(isLapsed(away19, RULE, NOW)).toBe(true);
    expect(isLapsed(away19, wide, NOW)).toBe(false);
  });

  it("tolerates a timestamp where a date was expected", () => {
    expect(
      isLapsed(member({ last_visit_at: "2024-01-05T09:30:00Z" }), RULE, NOW),
    ).toBe(true);
  });
});

describe("isContactable", () => {
  it("needs an address and consent", () => {
    expect(isContactable(member())).toBe(true);
    expect(isContactable(member({ email: null }))).toBe(false);
    expect(isContactable(member({ consent_email: false }))).toBe(false);
  });
});

describe("applyLapseFilter", () => {
  it("applies the same three conditions the in-memory check uses", () => {
    const calls: string[] = [];
    const query = {
      lte(column: string, value: string | number) {
        calls.push(`lte:${column}:${value}`);
        return query;
      },
      neq(column: string, value: string) {
        calls.push(`neq:${column}:${value}`);
        return query;
      },
    };

    applyLapseFilter(query, RULE, NOW);

    expect(calls).toEqual([
      "neq:status:opted_out",
      "lte:visit_count:2",
      "lte:last_visit_at:2025-08-13",
    ]);
  });
});

describe("monthsSince", () => {
  it("counts whole months only", () => {
    expect(monthsSince("2025-08-13", NOW)).toBe(12);
    expect(monthsSince("2025-08-14", NOW)).toBe(11);
    expect(monthsSince("2024-01-05", NOW)).toBe(31);
  });

  it("never goes negative on a same-day or future visit", () => {
    expect(monthsSince("2026-08-13", NOW)).toBe(0);
    expect(monthsSince("2026-12-01", NOW)).toBe(0);
  });

  it("returns null when there is nothing to measure", () => {
    expect(monthsSince(null, NOW)).toBeNull();
  });
});
