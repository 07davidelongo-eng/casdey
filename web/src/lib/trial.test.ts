import { describe, expect, it } from "vitest";

import {
  ACTIVATION_STEPS,
  MAKE_GOOD_DAYS,
  SETUP_FEE_MAX_STEPS,
  SETUP_FEE_MINOR,
  activationFor,
  feeForUnfinished,
  madeGood,
  nudgeDue,
  trialDayNumber,
  trialOutcome,
  unfinishedSteps,
  type ActivationEvidence,
} from "./trial";
import type { Gym } from "./types";

const NOW = new Date("2026-09-12T10:00:00Z");
/** trial_ends_at for a trial that has just run out. */
const ENDED = "2026-09-12T09:00:00Z";
/** trial_ends_at for a trial with time left. */
const RUNNING = "2026-09-15T09:00:00Z";

type TrialFields = Parameters<typeof trialOutcome>[0];

function gym(overrides: Partial<Gym> = {}): TrialFields {
  return {
    trial_ends_at: ENDED,
    trial_card_setup_at: "2026-09-05T09:00:00Z",
    trial_commitment_at: "2026-09-05T09:00:00Z",
    trial_cancelled_at: null,
    trial_converted_at: null,
    trial_closed_at: null,
    activated_import_at: null,
    activated_prices_at: null,
    activated_campaign_at: null,
    ...overrides,
  } as TrialFields;
}

const NOTHING: ActivationEvidence = {
  hasMembers: false,
  hasPricedServices: false,
  hasApprovedCampaign: false,
};

const EVERYTHING: ActivationEvidence = {
  hasMembers: true,
  hasPricedServices: true,
  hasApprovedCampaign: true,
};

describe("activationFor", () => {
  it("counts a step done from its timestamp", () => {
    const states = activationFor(
      gym({ activated_import_at: "2026-09-06T09:00:00Z" }),
      NOTHING,
    );
    const step = states.find((s) => s.step === "import");
    expect(step?.done).toBe(true);
    expect(step?.doneAt).toBe("2026-09-06T09:00:00Z");
  });

  it("counts a step done from live state even with no timestamp", () => {
    // The whole reason evidence exists. The stamps are written at three
    // separate action sites, and a gym that plainly has members must never be
    // charged €20 because one of those writes was missed.
    const states = activationFor(gym(), { ...NOTHING, hasMembers: true });
    const step = states.find((s) => s.step === "import");
    expect(step?.done).toBe(true);
    // And it cannot say when, which is why nothing schedules off doneAt.
    expect(step?.doneAt).toBeNull();
  });

  it("reports every step and only those steps", () => {
    expect(activationFor(gym(), NOTHING).map((s) => s.step)).toEqual([
      ...ACTIVATION_STEPS,
    ]);
  });

  it("lists what is left", () => {
    const states = activationFor(gym(), { ...NOTHING, hasMembers: true });
    expect(unfinishedSteps(states)).toEqual(["prices", "campaign"]);
  });
});

describe("feeForUnfinished", () => {
  it("charges per step", () => {
    expect(feeForUnfinished(["prices"], "eur")).toBe(SETUP_FEE_MINOR.eur);
    expect(feeForUnfinished(["prices", "campaign"], "eur")).toBe(
      2 * SETUP_FEE_MINOR.eur,
    );
  });

  it("charges nothing when nothing is outstanding", () => {
    expect(feeForUnfinished([], "eur")).toBe(0);
  });

  it("never exceeds the cap", () => {
    const many = ["import", "prices", "campaign", "import"] as const;
    expect(feeForUnfinished([...many], "eur")).toBe(
      SETUP_FEE_MAX_STEPS * SETUP_FEE_MINOR.eur,
    );
  });

  it("keeps GBP as its own round number, not a conversion", () => {
    expect(SETUP_FEE_MINOR.gbp).toBe(2000);
  });

  it("caps below a week of Pro, which is what the gym sat on", () => {
    // Pro is €289/mo, so a week is roughly €72. The cap has to sit under it
    // or the fee stops being a nudge and starts being a bill.
    const capMinor = SETUP_FEE_MAX_STEPS * SETUP_FEE_MINOR.eur;
    expect(capMinor).toBeLessThan(Math.round((28900 / 30) * 7));
  });
});

describe("trialOutcome", () => {
  it("waits while the trial is still running", () => {
    const outcome = trialOutcome(gym({ trial_ends_at: RUNNING }), NOTHING, NOW);
    expect(outcome.kind).toBe("wait");
  });

  it("waits on a trial it has already closed", () => {
    // The idempotency guard. Without it a second run of the daily job would
    // bill the same fees again.
    const outcome = trialOutcome(
      gym({ trial_closed_at: "2026-09-12T09:30:00Z" }),
      NOTHING,
      NOW,
    );
    expect(outcome.kind).toBe("wait");
  });

  it("waits on a gym that never had a trial", () => {
    const outcome = trialOutcome(gym({ trial_ends_at: null }), NOTHING, NOW);
    expect(outcome.kind).toBe("wait");
  });

  it("converts a gym that did all three", () => {
    expect(trialOutcome(gym(), EVERYTHING, NOW)).toEqual({ kind: "convert" });
  });

  it("charges a gym that ghosted, one fee per unfinished step", () => {
    const outcome = trialOutcome(gym(), { ...NOTHING, hasMembers: true }, NOW);
    expect(outcome).toEqual({ kind: "charge", steps: ["prices", "campaign"] });
  });

  it("charges nothing to a gym that cancelled, however little it did", () => {
    // Opting out is not ghosting. This leaves a loophole (use Pro for six
    // days, cancel, pay €1) and the plan accepts it deliberately.
    const outcome = trialOutcome(
      gym({ trial_cancelled_at: "2026-09-08T09:00:00Z" }),
      NOTHING,
      NOW,
    );
    expect(outcome.kind).toBe("release");
  });

  it("charges nothing when there is no card on file", () => {
    const outcome = trialOutcome(
      gym({ trial_card_setup_at: null }),
      NOTHING,
      NOW,
    );
    expect(outcome.kind).toBe("release");
  });

  it("does not convert a fully set-up gym with no card, it just ends", () => {
    const outcome = trialOutcome(
      gym({ trial_card_setup_at: null }),
      EVERYTHING,
      NOW,
    );
    expect(outcome.kind).toBe("release");
  });

  it("never charges a gym whose steps are proved done by live state alone", () => {
    // Same defensive reading as activationFor, asserted at the level that
    // actually moves money.
    const outcome = trialOutcome(gym(), EVERYTHING, NOW);
    expect(outcome.kind).not.toBe("charge");
  });
});

describe("trialDayNumber", () => {
  it("is day 1 on the first day", () => {
    // A 7-day trial ending 2026-09-12T09:00 started 2026-09-05T09:00.
    expect(trialDayNumber(ENDED, new Date("2026-09-05T10:00:00Z"))).toBe(1);
  });

  it("is day 7 on the last day", () => {
    expect(trialDayNumber(ENDED, new Date("2026-09-11T10:00:00Z"))).toBe(7);
  });

  it("is null once the trial is over", () => {
    expect(trialDayNumber(ENDED, NOW)).toBeNull();
  });

  it("is null before it starts", () => {
    expect(trialDayNumber(ENDED, new Date("2026-09-04T10:00:00Z"))).toBeNull();
  });
});

describe("nudgeDue", () => {
  const base = {
    trial_ends_at: ENDED,
    trial_cancelled_at: null,
    trial_last_nudge_day: null,
    trial_card_setup_at: "2026-09-05T09:00:00Z",
  };

  it("says nothing on day 1", () => {
    expect(
      nudgeDue(base, ["import"], new Date("2026-09-05T10:00:00Z")),
    ).toBeNull();
  });

  it("nudges on day 2", () => {
    expect(nudgeDue(base, ["import"], new Date("2026-09-06T10:00:00Z"))).toBe(2);
  });

  it("does not repeat a nudge already sent", () => {
    expect(
      nudgeDue(
        { ...base, trial_last_nudge_day: 2 },
        ["import"],
        new Date("2026-09-06T10:00:00Z"),
      ),
    ).toBeNull();
  });

  it("catches up with one message, not three", () => {
    // The cron runs once a day on Vercel's Hobby plan, so a missed run must
    // not turn into a burst of three emails.
    expect(nudgeDue(base, ["import"], new Date("2026-09-11T10:00:00Z"))).toBe(6);
  });

  it("says nothing once every step is done", () => {
    expect(nudgeDue(base, [], new Date("2026-09-11T10:00:00Z"))).toBeNull();
  });

  it("says nothing to a gym with no card, which owes no fee", () => {
    // A real incident, not a hypothetical. The first run of the day-7 job
    // emailed casdey's only real customer about a £20-a-step setup fee it
    // had never agreed to: it signed up weeks before Trial With Penalty
    // existed and has no card on file, so it can never be charged one.
    expect(
      nudgeDue(
        { ...base, trial_card_setup_at: null },
        ["import"],
        new Date("2026-09-11T10:00:00Z"),
      ),
    ).toBeNull();
  });

  it("says nothing to a gym that cancelled", () => {
    expect(
      nudgeDue(
        { ...base, trial_cancelled_at: "2026-09-06T09:00:00Z" },
        ["import"],
        new Date("2026-09-11T10:00:00Z"),
      ),
    ).toBeNull();
  });
});

describe("madeGood", () => {
  const charged = "2026-09-12T09:00:00Z";

  it("refunds a step finished the next day", () => {
    expect(madeGood(charged, "2026-09-13T09:00:00Z", NOW)).toBe(false);
    // ...as of NOW it has not happened yet; with a later clock it has.
    expect(
      madeGood(charged, "2026-09-13T09:00:00Z", new Date("2026-09-14T09:00:00Z")),
    ).toBe(true);
  });

  it("refunds right up to the deadline", () => {
    const atDeadline = new Date(
      new Date(charged).getTime() + MAKE_GOOD_DAYS * 86_400_000,
    ).toISOString();
    expect(madeGood(charged, atDeadline, new Date("2026-09-20T00:00:00Z"))).toBe(
      true,
    );
  });

  it("does not refund after the deadline", () => {
    const late = new Date(
      new Date(charged).getTime() + (MAKE_GOOD_DAYS + 1) * 86_400_000,
    ).toISOString();
    expect(madeGood(charged, late, new Date("2026-09-25T00:00:00Z"))).toBe(false);
  });

  it("does not refund a step that was never stamped", () => {
    // Evidence cannot answer "when", so there is nothing to measure against.
    // The waiver covers this case instead.
    expect(madeGood(charged, null, NOW)).toBe(false);
  });

  it("ignores a completion that predates the charge", () => {
    expect(madeGood(charged, "2026-09-01T09:00:00Z", NOW)).toBe(false);
  });
});
