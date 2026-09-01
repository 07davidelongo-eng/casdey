import { describe, expect, it } from "vitest";

import { capabilities, effectivePlan, trialDaysLeft } from "./plan";
import type { Gym } from "./types";

const NOW = new Date("2026-08-14T12:00:00Z");

function gym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: "pr1",
    created_at: "2026-08-14T00:00:00Z",
    name: "Test Gym",
    country: "GB",
    timezone: "Europe/London",
    contact_email: "a@b.co",
    sender_name: "Test Gym",
    reply_to_email: "a@b.co",
    lapsed_after_months: 12,
    max_visits: 2,
    at_risk_after_days: 45,
    daily_send_cap: 50,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: "none",
    plan_currency: null,
    plan_interval: null,
    trial_ends_at: null,
    current_period_end: null,
    premium_started_at: null,
    early_adopter: true,
    booking_value_minor: null,
    processing_agreed_at: null,
    onboarded_at: null,
    booking_enabled: false,
    booking_slot_minutes: 30,
    booking_buffer_minutes: 0,
    booking_min_notice_hours: 24,
    booking_horizon_days: 21,
    booking_hours: {},
    ...overrides,
  };
}

describe("effectivePlan", () => {
  it("is trial while the free week is still running", () => {
    const p = gym({ trial_ends_at: "2026-08-18T00:00:00Z" });
    expect(effectivePlan(p, NOW)).toBe("trial");
  });

  it("drops to free once the week is over", () => {
    const p = gym({ trial_ends_at: "2026-08-10T00:00:00Z" });
    expect(effectivePlan(p, NOW)).toBe("free");
  });

  it("is free for a gym that never had a trial", () => {
    expect(effectivePlan(gym(), NOW)).toBe("free");
  });

  it("is premium with an active subscription, trial date notwithstanding", () => {
    const p = gym({
      subscription_status: "active",
      trial_ends_at: "2026-08-10T00:00:00Z",
    });
    expect(effectivePlan(p, NOW)).toBe("premium");
  });

  it("keeps a past_due account on premium (grace), not free", () => {
    expect(
      effectivePlan(gym({ subscription_status: "past_due" }), NOW),
    ).toBe("premium");
  });

  it("returns to free after a premium subscription is cancelled", () => {
    const p = gym({
      subscription_status: "canceled",
      trial_ends_at: "2026-01-01T00:00:00Z",
    });
    expect(effectivePlan(p, NOW)).toBe("free");
  });
});

describe("capabilities", () => {
  it("lets a trial import and send", () => {
    const c = capabilities(
      gym({ trial_ends_at: "2026-08-18T00:00:00Z" }),
      NOW,
    );
    expect(c.canImport).toBe(true);
    expect(c.canSendCampaigns).toBe(true);
  });

  it("lets free import but never send", () => {
    const c = capabilities(gym(), NOW);
    expect(c.canImport).toBe(true);
    expect(c.canSendCampaigns).toBe(false);
  });

  it("lets active premium send", () => {
    const c = capabilities(gym({ subscription_status: "active" }), NOW);
    expect(c.canSendCampaigns).toBe(true);
  });

  it("stops a past_due premium from sending until the card is fixed", () => {
    const c = capabilities(gym({ subscription_status: "past_due" }), NOW);
    expect(c.plan).toBe("premium");
    expect(c.canSendCampaigns).toBe(false);
  });
});

describe("trialDaysLeft", () => {
  it("rounds up the days remaining", () => {
    expect(
      trialDaysLeft(gym({ trial_ends_at: "2026-08-17T06:00:00Z" }), NOW),
    ).toBe(3);
  });

  it("is null once the week is over or was never set", () => {
    expect(
      trialDaysLeft(gym({ trial_ends_at: "2026-08-13T00:00:00Z" }), NOW),
    ).toBeNull();
    expect(trialDaysLeft(gym(), NOW)).toBeNull();
  });
});
