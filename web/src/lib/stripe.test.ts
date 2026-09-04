import { afterEach, describe, expect, it } from "vitest";

import {
  PRICE_PLANS,
  couponIdFor,
  findPricePlan,
  planTierForPriceId,
  pricePlansFor,
} from "./stripe";

/**
 * The price -> tier mapping is what the Stripe webhook writes onto
 * gyms.plan_tier, and therefore what decides whether a paying gym gets the
 * WhatsApp channel and the refundable profit-or-nothing guarantee. It resolves
 * entirely from environment variables that are set by hand (plan item F2), so
 * the half-configured cases matter as much as the happy one.
 */

const ENV_KEYS = [
  ...PRICE_PLANS.map((p) => p.envVar),
  "STRIPE_COUPON_PERCENT",
  "STRIPE_COUPON_EUR",
  "STRIPE_COUPON_GBP",
];

const original = new Map(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const [key, value] of original) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function clearPriceEnv(): void {
  for (const plan of PRICE_PLANS) delete process.env[plan.envVar];
}

describe("PRICE_PLANS", () => {
  it("covers both paid tiers in both currencies, monthly and annual", () => {
    expect(PRICE_PLANS).toHaveLength(8);
    for (const tier of ["standard", "pro"] as const) {
      for (const currency of ["eur", "gbp"] as const) {
        expect(pricePlansFor(tier, currency).map((p) => p.interval).sort()).toEqual([
          "month",
          "year",
        ]);
      }
    }
  });

  it("gives every plan its own env var", () => {
    const vars = PRICE_PLANS.map((p) => p.envVar);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("prices Pro above Standard in both currencies", () => {
    const amount = (s: string) => Number(s.replace(/[^0-9]/g, ""));
    for (const currency of ["eur", "gbp"] as const) {
      const standard = findPricePlan("standard", currency, "month")!;
      const pro = findPricePlan("pro", currency, "month")!;
      expect(amount(pro.monthlyDisplay)).toBeGreaterThan(amount(standard.monthlyDisplay));
    }
  });

  it("makes annual cheaper per month than monthly", () => {
    const amount = (s: string) => Number(s.replace(/[^0-9]/g, ""));
    for (const plan of PRICE_PLANS.filter((p) => p.interval === "year")) {
      const monthly = findPricePlan(plan.tier, plan.currency, "month")!;
      expect(amount(plan.monthlyDisplay)).toBeLessThan(amount(monthly.monthlyDisplay));
    }
  });
});

describe("planTierForPriceId", () => {
  it("resolves a configured price to its own tier", () => {
    clearPriceEnv();
    process.env.STRIPE_PRICE_STANDARD_EUR_MONTH = "price_std_eur_m";
    process.env.STRIPE_PRICE_PRO_GBP_YEAR = "price_pro_gbp_y";

    expect(planTierForPriceId("price_std_eur_m")).toBe("standard");
    expect(planTierForPriceId("price_pro_gbp_y")).toBe("pro");
  });

  it("returns null for an unknown, empty or missing price id", () => {
    clearPriceEnv();
    process.env.STRIPE_PRICE_PRO_EUR_MONTH = "price_pro_eur_m";

    expect(planTierForPriceId("price_something_else")).toBeNull();
    expect(planTierForPriceId(null)).toBeNull();
    expect(planTierForPriceId(undefined)).toBeNull();
    expect(planTierForPriceId("")).toBeNull();
  });

  it("does not match an unset env var against an empty price id", () => {
    // Guards the shape of the lookup: without the truthiness check on the env
    // var, every unconfigured plan would match "" and the first tier in the
    // list would win.
    clearPriceEnv();
    expect(planTierForPriceId("")).toBeNull();
  });

  it("still resolves Standard when only the Standard vars are set", () => {
    // The half-configured case that motivated the metadata fallback in the
    // webhook: a Standard price must never resolve as Pro.
    clearPriceEnv();
    process.env.STRIPE_PRICE_STANDARD_EUR_MONTH = "price_std_eur_m";

    expect(planTierForPriceId("price_std_eur_m")).toBe("standard");
    expect(planTierForPriceId("price_pro_eur_m")).toBeNull();
  });
});

describe("couponIdFor", () => {
  it("uses the single flat percent coupon for both currencies", () => {
    process.env.STRIPE_COUPON_PERCENT = "coupon_20";
    expect(couponIdFor("eur")).toBe("coupon_20");
    expect(couponIdFor("gbp")).toBe("coupon_20");
  });

  it("falls back to the legacy per-currency coupons", () => {
    delete process.env.STRIPE_COUPON_PERCENT;
    process.env.STRIPE_COUPON_EUR = "coupon_eur";
    process.env.STRIPE_COUPON_GBP = "coupon_gbp";

    expect(couponIdFor("eur")).toBe("coupon_eur");
    expect(couponIdFor("gbp")).toBe("coupon_gbp");
  });

  it("is undefined when nothing is configured", () => {
    delete process.env.STRIPE_COUPON_PERCENT;
    delete process.env.STRIPE_COUPON_EUR;
    delete process.env.STRIPE_COUPON_GBP;

    expect(couponIdFor("eur")).toBeUndefined();
    expect(couponIdFor("gbp")).toBeUndefined();
  });
});
