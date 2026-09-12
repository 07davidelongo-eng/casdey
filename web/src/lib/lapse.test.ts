import { describe, expect, it } from "vitest";

import {
  applyAtRiskFilter,
  applyLapseFilter,
  atRiskCutoff,
  describeRule,
  hasChosenLapseRule,
  lapseCutoff,
  DEFAULT_LAPSE_DAYS,
  LAPSE_PRESETS,
  isAtRisk,
  isContactable,
  isLapsed,
  monthsSince,
  visitCeiling,
  VISIT_CEILING_OFF,
  type AtRiskRule,
  type LapseRule,
} from "./lapse";
import type { Member } from "./types";

const RULE: LapseRule = {
  window: { value: 12, unit: "months" },
  maxVisits: 2,
};
const AT_RISK_RULE: AtRiskRule = { ...RULE, atRiskAfterDays: 45 };
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
    cancellation_reason: null,
    cancelled_at: null,
    consent_email: true,
    consent_whatsapp: true,
    source: "csv",
    is_test: false,
    booking_token: "tok-p1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("the default window", () => {
  it("is a gym's cycle, not a dental recall cycle", () => {
    // 12 months was the default from 0002_saas.sql until 0037, and it meant a
    // new gym's first screen flagged only members gone a full year. The exact
    // number matters less than it staying inside the window reactivation is
    // actually measured over (30-180 days), so this guards the range.
    expect(DEFAULT_LAPSE_DAYS).toBeGreaterThanOrEqual(30);
    expect(DEFAULT_LAPSE_DAYS).toBeLessThanOrEqual(180);
  });

  it("leaves room for the check-in window under the DB constraint", () => {
    // gyms_at_risk_before_lapse requires at_risk_after_days to be strictly
    // shorter than the lapse window, and at_risk_after_days defaults to 45.
    // A default lapse window at or below that would make every new gym
    // unsaveable.
    expect(DEFAULT_LAPSE_DAYS).toBeGreaterThan(45);
  });

  it("is one of the windows a gym is offered", () => {
    expect(
      LAPSE_PRESETS.some(
        (w) => w.unit === "days" && w.value === DEFAULT_LAPSE_DAYS,
      ),
    ).toBe(true);
  });
});

describe("hasChosenLapseRule", () => {
  it("is false for a gym that only inherited the default", () => {
    expect(hasChosenLapseRule({ lapse_rule_set_at: null })).toBe(false);
  });

  it("is true once the gym has saved the rule itself", () => {
    expect(
      hasChosenLapseRule({ lapse_rule_set_at: "2026-09-12T09:00:00Z" }),
    ).toBe(true);
  });
});

describe("lapseCutoff", () => {
  it("goes back the configured number of months", () => {
    expect(lapseCutoff(RULE, NOW)).toBe("2025-08-13");
  });

  it("crosses a year boundary", () => {
    const now = new Date("2026-02-10T00:00:00Z");
    expect(lapseCutoff({ ...RULE, window: { value: 3, unit: "months" } }, now)).toBe(
      "2025-11-10",
    );
  });

  it("clamps rather than rolling into the next month", () => {
    // One month before 31 March is 28 February, not 3 March. JavaScript's own
    // date maths gets this wrong, which is why the function does it by hand.
    const now = new Date("2026-03-31T00:00:00Z");
    expect(lapseCutoff({ ...RULE, window: { value: 1, unit: "months" } }, now)).toBe(
      "2026-02-28",
    );
  });

  it("keeps 29 February when the target year is a leap year", () => {
    const now = new Date("2025-03-29T00:00:00Z");
    expect(lapseCutoff({ ...RULE, window: { value: 13, unit: "months" } }, now)).toBe(
      "2024-02-29",
    );
  });

  it("subtracts plain days when the gym set the window in days", () => {
    // 45 days back from 13 August is 29 June. Going via "one and a half
    // months" would land somewhere else, which is the whole reason a studio
    // picks days.
    expect(lapseCutoff({ ...RULE, window: { value: 45, unit: "days" } }, NOW)).toBe(
      "2026-06-29",
    );
  });

  it("crosses a year boundary in days too", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(lapseCutoff({ ...RULE, window: { value: 30, unit: "days" } }, now)).toBe(
      "2025-12-11",
    );
  });
});

describe("the visit ceiling", () => {
  const NO_CEILING: LapseRule = { ...RULE, maxVisits: null };

  it("keeps a long-standing regular out of win-back while it is on", () => {
    const regular = member({ visit_count: 90, last_visit_at: "2024-01-01" });
    expect(isLapsed(regular, RULE, NOW)).toBe(false);
  });

  it("includes that same regular once the gym switches it off", () => {
    const regular = member({ visit_count: 90, last_visit_at: "2024-01-01" });
    expect(isLapsed(regular, NO_CEILING, NOW)).toBe(true);
  });

  it("still excludes someone who has not been quiet long enough", () => {
    const recent = member({ visit_count: 90, last_visit_at: "2026-08-01" });
    expect(isLapsed(recent, NO_CEILING, NOW)).toBe(false);
  });

  it("gives queries a ceiling no visit count can exceed, never null", () => {
    // Passing null into a PostgREST .lte() matches nobody, so a gym that
    // widened its rule would see an empty list instead of everyone.
    expect(visitCeiling(NO_CEILING)).toBe(VISIT_CEILING_OFF);
    expect(visitCeiling(RULE)).toBe(2);
  });
});

describe("describeRule", () => {
  it("says the window in the unit the gym chose", () => {
    expect(describeRule({ ...RULE, window: { value: 45, unit: "days" } })).toBe(
      "no visit for 45 days, and at most 2 visits on record",
    );
  });

  it("drops the visit clause entirely when the ceiling is off", () => {
    expect(describeRule({ ...RULE, maxVisits: null })).toBe(
      "no visit for 12 months",
    );
  });

  it("singularises a window of one", () => {
    expect(
      describeRule({ window: { value: 1, unit: "months" }, maxVisits: 1 }),
    ).toBe("no visit for 1 month, and at most 1 visit on record");
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
    const wide: LapseRule = {
      window: { value: 24, unit: "months" },
      maxVisits: 2,
    };
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

describe("atRiskCutoff", () => {
  it("goes back the configured number of days", () => {
    expect(atRiskCutoff(AT_RISK_RULE, NOW)).toBe("2026-06-29");
  });
});

describe("isAtRisk", () => {
  it("catches a still-active member inside the at-risk window", () => {
    // 2026-08-13 minus 60 days is well inside the 45-day-to-12-month range.
    expect(
      isAtRisk(member({ last_visit_at: "2026-06-14" }), AT_RISK_RULE, NOW),
    ).toBe(true);
  });

  it("ignores someone who visited too recently", () => {
    expect(
      isAtRisk(member({ last_visit_at: "2026-08-01" }), AT_RISK_RULE, NOW),
    ).toBe(false);
  });

  it("defers to isLapsed once a member crosses the full lapse cutoff", () => {
    const lapsed = member({ last_visit_at: lapseCutoff(RULE, NOW) });
    expect(isLapsed(lapsed, RULE, NOW)).toBe(true);
    expect(isAtRisk(lapsed, AT_RISK_RULE, NOW)).toBe(false);
  });

  it("only applies to members nobody has campaigned yet", () => {
    expect(
      isAtRisk(
        member({ last_visit_at: "2026-06-14", status: "contacted" }),
        AT_RISK_RULE,
        NOW,
      ),
    ).toBe(false);
    expect(
      isAtRisk(
        member({ last_visit_at: "2026-06-14", status: "returned" }),
        AT_RISK_RULE,
        NOW,
      ),
    ).toBe(false);
  });

  it("catches a regular going quiet, unlike isLapsed", () => {
    const regular = member({ visit_count: 9, last_visit_at: "2026-06-14" });
    // The visit cap keeps a nine-time member out of win-back, but a check-in
    // is exactly the message that member should get.
    expect(isLapsed(regular, RULE, NOW)).toBe(false);
    expect(isAtRisk(regular, AT_RISK_RULE, NOW)).toBe(true);
  });
});

describe("applyAtRiskFilter", () => {
  it("applies the active-status and two-sided date range, and no visit cap", () => {
    const calls: string[] = [];
    const query = {
      eq(column: string, value: string) {
        calls.push(`eq:${column}:${value}`);
        return query;
      },
      lte(column: string, value: string | number) {
        calls.push(`lte:${column}:${value}`);
        return query;
      },
      gt(column: string, value: string | number) {
        calls.push(`gt:${column}:${value}`);
        return query;
      },
    };

    applyAtRiskFilter(query, AT_RISK_RULE, NOW);

    expect(calls).toEqual([
      "eq:status:active",
      "gt:last_visit_at:2025-08-13",
      "lte:last_visit_at:2026-06-29",
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
