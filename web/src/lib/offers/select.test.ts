import { describe, expect, it } from "vitest";

import { OFFERS } from "./library";
import { deadlineFrom, formatDeadline, rankOffers, renderOffer } from "./select";
import type { OfferInputs } from "./types";

function inputs(overrides: Partial<OfferInputs> = {}): OfferInputs {
  return {
    gymType: "crossfit_box",
    reason: "unknown",
    budget: "small_giveaway",
    hasOffPeakCapacity: true,
    deadlineDays: 14,
    ...overrides,
  };
}

describe("the library itself", () => {
  it("has no duplicate ids", () => {
    const ids = OFFERS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves the deadline for the sender to fill, in every dated offer", () => {
    // A member reading "expires in 14 days" has to do arithmetic and will not.
    // The undated one is the honest check-in, which asks a question rather than
    // making a promise; a deadline on a question would be a tactic.
    for (const offer of OFFERS) {
      if (offer.dated) expect(offer.memberFacing).toContain("{{deadline}}");
      else expect(offer.memberFacing).not.toContain("{{deadline}}");
    }
  });

  it("never uses an em dash, per casdey's copy rule", () => {
    for (const offer of OFFERS) {
      expect(offer.memberFacing).not.toContain("—");
      expect(offer.name).not.toContain("—");
    }
  });

  it("always leaves a gym with something to send", () => {
    // Every combination of answers must produce at least one offer. A gym that
    // answers honestly and is told "nothing suits you" has been failed by the
    // tool at the exact moment it asked for help.
    const gymTypes = ["crossfit_box", "general_gym", "boutique_studio", "pt_studio"] as const;
    const reasons = ["price", "time", "motivation", "intimidation", "injury", "moved", "unknown"] as const;
    const budgets = ["capacity_only", "small_giveaway", "real_discount"] as const;

    for (const gymType of gymTypes) {
      for (const reason of reasons) {
        for (const budget of budgets) {
          for (const hasOffPeakCapacity of [true, false]) {
            const ranked = rankOffers(
              inputs({ gymType, reason, budget, hasOffPeakCapacity }),
            );
            expect(
              ranked.length,
              `no offer for ${gymType}/${reason}/${budget}/offpeak=${hasOffPeakCapacity}`,
            ).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe("ranking", () => {
  it("never proposes an offer the gym cannot afford", () => {
    const ranked = rankOffers(inputs({ budget: "capacity_only" }));
    for (const { offer } of ranked) {
      expect(offer.fits.budgets).toContain("capacity_only");
    }
  });

  it("never proposes an offer that needs quiet hours to a gym with none", () => {
    const ranked = rankOffers(inputs({ hasOffPeakCapacity: false }));
    for (const { offer } of ranked) {
      expect(offer.fits.needsOffPeak).not.toBe(true);
    }
  });

  it("answers the reason they left, rather than discounting at it", () => {
    // Someone who left because the room intimidated them is not persuaded by
    // money off the same room.
    const top = rankOffers(inputs({ reason: "intimidation", budget: "real_discount" }))[0];
    expect(top.offer.fits.reasons).toContain("intimidation");
  });

  it("puts an injury-specific offer first for an injury", () => {
    const top = rankOffers(inputs({ reason: "injury", budget: "small_giveaway" }))[0];
    expect(top.offer.id).toBe("return_after_injury");
  });

  it("always offers a straight discounted return when the gym can afford one", () => {
    // The Spotify/Netflix pattern: come back cheap for a run-in, then normal
    // price. It is the win-back a lapsed member already recognises without
    // explanation, so a gym willing to spend margin must always be shown it.
    for (const reason of ["price", "time", "motivation", "unknown"] as const) {
      const ranked = rankOffers(inputs({ reason, budget: "real_discount" }));
      expect(
        ranked.some((r) => r.offer.id === "comeback_rate"),
        `no comeback rate offered for reason=${reason}`,
      ).toBe(true);
    }
  });

  it("offers the price answer to a price objection", () => {
    const ranked = rankOffers(inputs({ reason: "price", budget: "real_discount" }));
    expect(ranked.map((r) => r.offer.fits.reasons.includes("price"))).toContain(true);
  });
});

describe("the deadline", () => {
  it("is a real date a member can act on, not a countdown", () => {
    const deadline = deadlineFrom(new Date("2026-09-05T12:00:00Z"), 14);
    expect(formatDeadline(deadline)).toBe("Saturday 19 September");
  });

  it("is filled into the message that actually sends", () => {
    const offer = OFFERS.find((o) => o.id === "free_week_no_card")!;
    const rendered = renderOffer(offer, new Date("2026-09-19T12:00:00Z"));
    expect(rendered).toContain("Saturday 19 September");
    expect(rendered).not.toContain("{{deadline}}");
  });
});
