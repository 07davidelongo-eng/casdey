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

/**
 * PRICE_PLANS (what the app charges) and scripts/price-spec.mjs (what the setup
 * script creates in Stripe and what the check script verifies) describe the same
 * eight prices. They are separate files because one is TypeScript the app
 * imports and the other is a plain module the Node scripts import, so nothing
 * but this test stops them drifting apart — and drifting apart means the app
 * offering a price Stripe never created, or the checker approving the wrong
 * amount.
 */
describe("PRICE_PLANS vs the script price spec", () => {
  it("covers exactly the same eight env vars", async () => {
    const { AMOUNTS } = await import("../../scripts/price-spec.mjs");

    expect(AMOUNTS.map((a: { envVar: string }) => a.envVar).sort()).toEqual(
      PRICE_PLANS.map((p) => p.envVar).sort(),
    );
  });

  it("agrees on the tier, currency and interval behind each env var", async () => {
    const { AMOUNTS } = await import("../../scripts/price-spec.mjs");

    for (const amount of AMOUNTS) {
      const plan = PRICE_PLANS.find((p) => p.envVar === amount.envVar);
      expect(plan, `no PRICE_PLANS entry for ${amount.envVar}`).toBeDefined();
      expect({
        tier: plan!.tier,
        currency: plan!.currency,
        interval: plan!.interval,
      }).toEqual({
        tier: amount.tier,
        currency: amount.currency,
        interval: amount.interval,
      });
    }
  });

  it("shows the customer the amount Stripe actually charges", async () => {
    const { AMOUNTS } = await import("../../scripts/price-spec.mjs");

    // chargeDisplay is the "what leaves the account" string on the billing page.
    // It must contain the real figure, or the page quotes a price we do not take.
    for (const amount of AMOUNTS) {
      const plan = PRICE_PLANS.find((p) => p.envVar === amount.envVar)!;
      const symbol = amount.currency === "gbp" ? "£" : "€";
      const figure = (amount.amount / 100).toLocaleString("en-GB");

      expect(
        plan.chargeDisplay,
        `${amount.envVar}: "${plan.chargeDisplay}" should quote ${symbol}${figure}`,
      ).toContain(`${symbol}${figure}`);
      expect(plan.chargeDisplay).toContain(
        amount.interval === "year" ? "a year" : "a month",
      );
    }
  });
});
