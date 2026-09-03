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
    plan_tier: null,
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
    whatsapp_enabled: false,
    whatsapp_template_name: null,
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

  it("returns the stored paid tier for an active subscription", () => {
    expect(
      effectivePlan(
        gym({ subscription_status: "active", plan_tier: "standard" }),
        NOW,
      ),
    ).toBe("standard");
    expect(
      effectivePlan(
        gym({ subscription_status: "active", plan_tier: "pro" }),
        NOW,
      ),
    ).toBe("pro");
  });

  it("ignores the trial date once a paid subscription is live", () => {
    const p = gym({
      subscription_status: "active",
      plan_tier: "standard",
      trial_ends_at: "2026-08-10T00:00:00Z",
    });
    expect(effectivePlan(p, NOW)).toBe("standard");
  });

  it("defaults a tier-less active subscription to pro (the safer grant)", () => {
    expect(
      effectivePlan(gym({ subscription_status: "active", plan_tier: null }), NOW),
    ).toBe("pro");
  });

  it("keeps a past_due account on its paid tier (grace), not free", () => {
    expect(
      effectivePlan(
        gym({ subscription_status: "past_due", plan_tier: "pro" }),
        NOW,
      ),
    ).toBe("pro");
  });

  it("returns to free after a subscription is cancelled", () => {
    const p = gym({
      subscription_status: "canceled",
      plan_tier: "pro",
      trial_ends_at: "2026-01-01T00:00:00Z",
    });
    expect(effectivePlan(p, NOW)).toBe("free");
  });
});

describe("capabilities", () => {
  it("lets a trial import and send, with the full feature set", () => {
    const c = capabilities(gym({ trial_ends_at: "2026-08-18T00:00:00Z" }), NOW);
    expect(c.canImport).toBe(true);
    expect(c.canSendCampaigns).toBe(true);
    expect(c.canUseWhatsApp).toBe(true);
    expect(c.hasGuarantee).toBe(true);
    expect(c.memberImportLimit).toBeNull();
  });

  it("lets free import but never send, and caps it", () => {
    const c = capabilities(gym(), NOW);
    expect(c.canImport).toBe(true);
    expect(c.canSendCampaigns).toBe(false);
    expect(c.canUseWhatsApp).toBe(false);
    expect(c.hasGuarantee).toBe(false);
    expect(c.memberListLimit).toBe(5);
    expect(c.memberImportLimit).toBe(50);
  });

  it("Standard: sends email, no WhatsApp, no guarantee, member cap", () => {
    const c = capabilities(
      gym({ subscription_status: "active", plan_tier: "standard" }),
      NOW,
    );
    expect(c.canSendCampaigns).toBe(true);
    expect(c.canUseWhatsApp).toBe(false);
    expect(c.hasGuarantee).toBe(false);
    expect(c.memberListLimit).toBeNull();
    expect(c.memberImportLimit).toBe(500);
  });

  it("Pro: sends everything, WhatsApp + guarantee, uncapped", () => {
    const c = capabilities(
      gym({ subscription_status: "active", plan_tier: "pro" }),
      NOW,
    );
    expect(c.canSendCampaigns).toBe(true);
    expect(c.canUseWhatsApp).toBe(true);
    expect(c.hasGuarantee).toBe(true);
    expect(c.memberImportLimit).toBeNull();
  });

  it("stops a past_due paid tier from sending, but keeps its feature grants", () => {
    const c = capabilities(
      gym({ subscription_status: "past_due", plan_tier: "pro" }),
      NOW,
    );
    expect(c.plan).toBe("pro");
    expect(c.canSendCampaigns).toBe(false);
    // The grant is still Pro's; only the send is held pending the card.
    expect(c.canUseWhatsApp).toBe(true);
    expect(c.hasGuarantee).toBe(true);
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
