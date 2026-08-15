import { describe, expect, it } from "vitest";

import {
  applyDormancyFilter,
  dormancyCutoff,
  isContactable,
  isDormant,
  monthsSince,
  type DormancyRule,
} from "./dormancy";
import type { Patient } from "./types";

const RULE: DormancyRule = { dormantAfterMonths: 12, maxVisits: 2 };
const NOW = new Date("2026-08-13T10:00:00Z");

function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p1",
    practice_id: "pr1",
    external_ref: null,
    first_name: "Jane",
    last_name: "Okafor",
    email: "jane@example.com",
    phone: null,
    last_visit_at: "2024-01-05",
    visit_count: 2,
    status: "active",
    contacted_at: null,
    reactivated_at: null,
    consent_email: true,
    consent_whatsapp: true,
    source: "csv",
    is_test: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("dormancyCutoff", () => {
  it("goes back the configured number of months", () => {
    expect(dormancyCutoff(RULE, NOW)).toBe("2025-08-13");
  });

  it("crosses a year boundary", () => {
    const now = new Date("2026-02-10T00:00:00Z");
    expect(dormancyCutoff({ ...RULE, dormantAfterMonths: 3 }, now)).toBe(
      "2025-11-10",
    );
  });

  it("clamps rather than rolling into the next month", () => {
    // One month before 31 March is 28 February, not 3 March. JavaScript's own
    // date maths gets this wrong, which is why the function does it by hand.
    const now = new Date("2026-03-31T00:00:00Z");
    expect(dormancyCutoff({ ...RULE, dormantAfterMonths: 1 }, now)).toBe(
      "2026-02-28",
    );
  });

  it("keeps 29 February when the target year is a leap year", () => {
    const now = new Date("2025-03-29T00:00:00Z");
    expect(dormancyCutoff({ ...RULE, dormantAfterMonths: 13 }, now)).toBe(
      "2024-02-29",
    );
  });
});

describe("isDormant", () => {
  it("catches a patient who came twice and stopped", () => {
    expect(isDormant(patient(), RULE, NOW)).toBe(true);
  });

  it("ignores someone who came back recently", () => {
    expect(isDormant(patient({ last_visit_at: "2026-06-01" }), RULE, NOW)).toBe(
      false,
    );
  });

  it("ignores a regular, however long ago they last came", () => {
    // Nine visits is a loyal patient having a gap, not a drop-off.
    expect(
      isDormant(patient({ visit_count: 9, last_visit_at: "2020-01-01" }), RULE, NOW),
    ).toBe(false);
  });

  it("treats the cutoff date itself as dormant", () => {
    expect(
      isDormant(patient({ last_visit_at: dormancyCutoff(RULE, NOW) }), RULE, NOW),
    ).toBe(true);
  });

  it("treats the day after the cutoff as not dormant", () => {
    expect(isDormant(patient({ last_visit_at: "2025-08-14" }), RULE, NOW)).toBe(
      false,
    );
  });

  it("never counts someone who opted out", () => {
    expect(
      isDormant(patient({ status: "opted_out" }), RULE, NOW),
    ).toBe(false);
  });

  it("still counts someone already contacted, so a campaign can follow up", () => {
    expect(isDormant(patient({ status: "contacted" }), RULE, NOW)).toBe(true);
  });

  it("ignores a patient with no visit on record", () => {
    expect(isDormant(patient({ last_visit_at: null }), RULE, NOW)).toBe(false);
  });

  it("follows the practice's own window", () => {
    const wide: DormancyRule = { dormantAfterMonths: 24, maxVisits: 2 };
    // Away 19 months: dormant under a 12-month window, not under a 24-month one.
    const away19 = patient({ last_visit_at: "2025-01-13" });
    expect(isDormant(away19, RULE, NOW)).toBe(true);
    expect(isDormant(away19, wide, NOW)).toBe(false);
  });

  it("tolerates a timestamp where a date was expected", () => {
    expect(
      isDormant(patient({ last_visit_at: "2024-01-05T09:30:00Z" }), RULE, NOW),
    ).toBe(true);
  });
});

describe("isContactable", () => {
  it("needs an address and consent", () => {
    expect(isContactable(patient())).toBe(true);
    expect(isContactable(patient({ email: null }))).toBe(false);
    expect(isContactable(patient({ consent_email: false }))).toBe(false);
  });
});

describe("applyDormancyFilter", () => {
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

    applyDormancyFilter(query, RULE, NOW);

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
