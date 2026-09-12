import { describe, expect, it } from "vitest";

import {
  ACTIVATION_STEPS,
  activationFor,
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
    stripe_subscription_id: "sub_live",
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

describe("trialOutcome", () => {
  it("waits while the week is still running", () => {
    expect(trialOutcome(gym({ trial_ends_at: RUNNING }), NOW).kind).toBe(
      "wait",
    );
  });

  it("waits on a week it has already closed", () => {
    // The idempotency guard. Without it a second run of the daily job would
    // create a second subscription for the same gym.
    const outcome = trialOutcome(
      gym({ trial_closed_at: "2026-09-12T09:30:00Z" }),
      NOW,
    );
    expect(outcome.kind).toBe("wait");
  });

  it("waits on a gym that never had a week", () => {
    expect(trialOutcome(gym({ trial_ends_at: null }), NOW).kind).toBe("wait");
  });

  it("hands the week to Stripe when a subscription is behind it", () => {
    expect(trialOutcome(gym(), NOW)).toEqual({ kind: "stripe_owns" });
  });

  /**
   * The change of 2026-09-12. Under Trial With Penalty an unfinished step was
   * a billable event, so a gym that did nothing was charged a setup fee and
   * dropped to Free. The week is now sold rather than given, so what the gym
   * did with it decides nothing: it bought a week of Pro and the subscription
   * continues. Activation still drives the nudges, it just no longer touches
   * anyone's money.
   */
  it("treats a gym that did nothing the same as one that did everything", () => {
    expect(trialOutcome(gym(), NOW)).toEqual({ kind: "stripe_owns" });
    expect(
      trialOutcome(
        gym({
          activated_import_at: "2026-09-06T09:00:00Z",
          activated_prices_at: "2026-09-06T09:00:00Z",
          activated_campaign_at: "2026-09-06T09:00:00Z",
        }),
        NOW,
      ),
    ).toEqual({ kind: "stripe_owns" });
  });

  /**
   * The guard that makes this safe to deploy over existing accounts. A gym
   * from before the paid week has a trial_ends_at but no subscription, so
   * there is nothing for Stripe to bill and the week simply ends.
   */
  it("releases a gym with a card but no subscription", () => {
    expect(
      trialOutcome(gym({ stripe_subscription_id: null }), NOW).kind,
    ).toBe("release");
  });

  it("charges nothing to a gym that cancelled", () => {
    const outcome = trialOutcome(
      gym({ trial_cancelled_at: "2026-09-08T09:00:00Z" }),
      NOW,
    );
    expect(outcome.kind).toBe("release");
  });

  /**
   * The branch BodyActive takes. Gyms that signed up before the paid week
   * existed have no card and were promised a free week on the old terms, so
   * theirs has to end without a charge. This is the guard that makes the whole
   * change safe to deploy to an existing account.
   */
  it("releases, never bills, when there is no card on file", () => {
    expect(
      trialOutcome(gym({ trial_card_setup_at: null }), NOW).kind,
    ).toBe("release");
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

  it("stays quiet on days 2 and 5 once every step is done", () => {
    // The week starts 2026-09-05, so day 5 is the 9th and day 6 the 10th.
    expect(nudgeDue(base, [], new Date("2026-09-09T10:00:00Z"))).toBeNull();
  });

  /**
   * Day 6 is not a setup reminder, it is the only warning before a card is
   * charged a few hundred euro, so it goes out to a gym that did everything
   * right as well as one that did nothing. Under the old design it was correct
   * to stay silent here, because the only thing to warn about was a setup fee
   * a finished gym could no longer incur. Removing the fee inverted that.
   */
  it("still warns on day 6 even when there is nothing left to do", () => {
    expect(nudgeDue(base, [], new Date("2026-09-11T10:00:00Z"))).toBe(6);
  });

  it("says nothing to a gym with no card, which cannot be charged", () => {
    // A real incident, not a hypothetical. The first run of this job emailed
    // casdey's only real customer about a setup fee it had never agreed to:
    // it signed up weeks before any of this existed and has no card on file.
    // The fee is gone now; the guard stays, because a gym with no card still
    // cannot convert and must not be told it is about to be billed.
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
