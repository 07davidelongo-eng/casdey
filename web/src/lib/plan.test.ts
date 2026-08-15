import { describe, expect, it } from "vitest";

import { capabilities, effectivePlan, trialDaysLeft } from "./plan";
import type { Practice } from "./types";

const NOW = new Date("2026-08-14T12:00:00Z");

function practice(overrides: Partial<Practice> = {}): Practice {
  return {
    id: "pr1",
    created_at: "2026-08-14T00:00:00Z",
    name: "Test Dental",
    country: "GB",
    timezone: "Europe/London",
    contact_email: "a@b.co",
    sender_name: "Test Dental",
    reply_to_email: "a@b.co",
    dormant_after_months: 12,
    max_visits: 2,
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
    appointment_value_minor: null,
    processing_agreed_at: null,
    onboarded_at: null,
    whatsapp_enabled: false,
    whatsapp_template_name: null,
    ...overrides,
  };
}

describe("effectivePlan", () => {
  it("is trial while the free week is still running", () => {
    const p = practice({ trial_ends_at: "2026-08-18T00:00:00Z" });
    expect(effectivePlan(p, NOW)).toBe("trial");
  });

  it("drops to free once the week is over", () => {
    const p = practice({ trial_ends_at: "2026-08-10T00:00:00Z" });
    expect(effectivePlan(p, NOW)).toBe("free");
  });

  it("is free for a practice that never had a trial", () => {
    expect(effectivePlan(practice(), NOW)).toBe("free");
  });

  it("is premium with an active subscription, trial date notwithstanding", () => {
    const p = practice({
      subscription_status: "active",
      trial_ends_at: "2026-08-10T00:00:00Z",
    });
    expect(effectivePlan(p, NOW)).toBe("premium");
  });

  it("keeps a past_due account on premium (grace), not free", () => {
    expect(
      effectivePlan(practice({ subscription_status: "past_due" }), NOW),
    ).toBe("premium");
  });

  it("returns to free after a premium subscription is cancelled", () => {
    const p = practice({
      subscription_status: "canceled",
      trial_ends_at: "2026-01-01T00:00:00Z",
    });
    expect(effectivePlan(p, NOW)).toBe("free");
  });
});

describe("capabilities", () => {
  it("lets a trial import and send", () => {
    const c = capabilities(
      practice({ trial_ends_at: "2026-08-18T00:00:00Z" }),
      NOW,
    );
    expect(c.canImport).toBe(true);
    expect(c.canSendCampaigns).toBe(true);
  });

  it("lets free import but never send", () => {
    const c = capabilities(practice(), NOW);
    expect(c.canImport).toBe(true);
    expect(c.canSendCampaigns).toBe(false);
  });

  it("lets active premium send", () => {
    const c = capabilities(practice({ subscription_status: "active" }), NOW);
    expect(c.canSendCampaigns).toBe(true);
  });

  it("stops a past_due premium from sending until the card is fixed", () => {
    const c = capabilities(practice({ subscription_status: "past_due" }), NOW);
    expect(c.plan).toBe("premium");
    expect(c.canSendCampaigns).toBe(false);
  });
});

describe("trialDaysLeft", () => {
  it("rounds up the days remaining", () => {
    expect(
      trialDaysLeft(practice({ trial_ends_at: "2026-08-17T06:00:00Z" }), NOW),
    ).toBe(3);
  });

  it("is null once the week is over or was never set", () => {
    expect(
      trialDaysLeft(practice({ trial_ends_at: "2026-08-13T00:00:00Z" }), NOW),
    ).toBeNull();
    expect(trialDaysLeft(practice(), NOW)).toBeNull();
  });
});
