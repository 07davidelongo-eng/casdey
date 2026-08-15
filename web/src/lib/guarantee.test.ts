import { describe, expect, it } from "vitest";

import { GUARANTEE_WINDOW_DAYS, guaranteeStatus, guaranteeWindow } from "./guarantee";
import type { GuaranteeClaim } from "./types";

const DAY = 86_400_000;

describe("guaranteeWindow", () => {
  it("is null before the practice has paid", () => {
    expect(guaranteeWindow(null, "2026-08-01T00:00:00Z")).toBeNull();
  });

  it("is null before a paid campaign has started", () => {
    expect(guaranteeWindow("2026-08-01T00:00:00Z", null)).toBeNull();
  });

  it("runs 30 days from the qualifying campaign, not from payment", () => {
    const window = guaranteeWindow(
      "2026-08-01T00:00:00Z",
      "2026-08-10T00:00:00Z",
    );
    expect(window).not.toBeNull();
    expect(window!.start.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(window!.end.getTime() - window!.start.getTime()).toBe(
      GUARANTEE_WINDOW_DAYS * DAY,
    );
  });
});

describe("guaranteeStatus", () => {
  const claim: GuaranteeClaim = {
    id: "claim-1",
    practice_id: "practice-1",
    window_start: "2026-08-10T00:00:00Z",
    window_end: "2026-09-09T00:00:00Z",
    revenue_recovered_minor: 0,
    paid_minor: 25000,
    refunded_minor: 25000,
    stripe_refund_ids: ["re_123"],
    status: "refunded",
    created_at: "2026-09-09T00:00:00Z",
  };

  it("is not_started with reason not_premium before any payment", () => {
    expect(
      guaranteeStatus({
        premiumStartedAt: null,
        firstPaidCampaignStartedAt: null,
        revenueRecoveredMinor: 0,
        paidMinor: 0,
        existingClaim: null,
      }),
    ).toEqual({ state: "not_started", reason: "not_premium" });
  });

  it("is not_started with reason no_campaign once paying but before sending", () => {
    expect(
      guaranteeStatus({
        premiumStartedAt: "2026-08-01T00:00:00Z",
        firstPaidCampaignStartedAt: null,
        revenueRecoveredMinor: 0,
        paidMinor: 0,
        existingClaim: null,
      }),
    ).toEqual({ state: "not_started", reason: "no_campaign" });
  });

  it("is running while inside the 30 days, counting whole days left and carrying progress so far", () => {
    const status = guaranteeStatus({
      premiumStartedAt: "2026-08-01T00:00:00Z",
      firstPaidCampaignStartedAt: "2026-08-10T00:00:00Z",
      revenueRecoveredMinor: 6000,
      paidMinor: 25000,
      existingClaim: null,
      now: new Date("2026-08-11T00:00:00Z"),
    });
    expect(status.state).toBe("running");
    if (status.state === "running") {
      expect(status.daysLeft).toBe(29);
      expect(status.revenueRecoveredMinor).toBe(6000);
      expect(status.paidMinor).toBe(25000);
    }
  });

  it("is met once the window closes with revenue covering what was paid", () => {
    const status = guaranteeStatus({
      premiumStartedAt: "2026-08-01T00:00:00Z",
      firstPaidCampaignStartedAt: "2026-08-10T00:00:00Z",
      revenueRecoveredMinor: 30000,
      paidMinor: 25000,
      existingClaim: null,
      now: new Date("2026-09-10T00:00:00Z"),
    });
    expect(status.state).toBe("met");
  });

  it("is met, not claimable, when nothing was actually charged in the window", () => {
    const status = guaranteeStatus({
      premiumStartedAt: "2026-08-01T00:00:00Z",
      firstPaidCampaignStartedAt: "2026-08-10T00:00:00Z",
      revenueRecoveredMinor: 0,
      paidMinor: 0,
      existingClaim: null,
      now: new Date("2026-09-10T00:00:00Z"),
    });
    expect(status.state).toBe("met");
  });

  it("is claimable once the window closes with revenue short of what was paid", () => {
    const status = guaranteeStatus({
      premiumStartedAt: "2026-08-01T00:00:00Z",
      firstPaidCampaignStartedAt: "2026-08-10T00:00:00Z",
      revenueRecoveredMinor: 10000,
      paidMinor: 25000,
      existingClaim: null,
      now: new Date("2026-09-10T00:00:00Z"),
    });
    expect(status.state).toBe("claimable");
  });

  it("is exactly at the boundary: equal revenue and paid counts as met", () => {
    const status = guaranteeStatus({
      premiumStartedAt: "2026-08-01T00:00:00Z",
      firstPaidCampaignStartedAt: "2026-08-10T00:00:00Z",
      revenueRecoveredMinor: 25000,
      paidMinor: 25000,
      existingClaim: null,
      now: new Date("2026-09-10T00:00:00Z"),
    });
    expect(status.state).toBe("met");
  });

  it("is claimed once a claim exists, regardless of the numbers", () => {
    const status = guaranteeStatus({
      premiumStartedAt: "2026-08-01T00:00:00Z",
      firstPaidCampaignStartedAt: "2026-08-10T00:00:00Z",
      revenueRecoveredMinor: 999_999,
      paidMinor: 1,
      existingClaim: claim,
      now: new Date("2026-09-10T00:00:00Z"),
    });
    expect(status).toEqual({ state: "claimed", claim });
  });
});
