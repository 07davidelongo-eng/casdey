/**
 * The single description of casdey's paid Stripe catalogue: two products, eight
 * prices, one coupon.
 *
 * Pure data, no side effects, so it can be imported by the setup script, the
 * check script, and the test suite alike. It exists because the same table was
 * previously written out twice (stripe-setup.mjs and src/lib/stripe.ts), and
 * two copies of a price list is exactly the kind of drift that ships a wrong
 * charge. `src/lib/stripe.test.ts` asserts this file and PRICE_PLANS agree.
 *
 * casdey's market is Europe, so prices lead in EUR; GBP keeps its own round
 * numbers for the UK, not a live conversion. Annual is "two months free",
 * i.e. 10x the monthly rate. See SAAS_V1_PLAN.md §F0.
 */

export const PRODUCTS = [
  {
    id: "casdey_standard",
    name: "casdey Standard",
    description:
      "Lapsed-member win-back for gyms: email win-back + at-risk campaigns, casdey-owned booking, up to 200 members.",
  },
  {
    id: "casdey_pro",
    name: "casdey Pro",
    description:
      "Everything in Standard, plus the WhatsApp channel, the profit-or-nothing guarantee, and up to 2,000 members.",
  },
];

/**
 * Amounts are in the smallest currency unit, the way Stripe stores them.
 * `tier` mirrors PlanTier in src/lib/types.ts; `envVar` mirrors PricePlan.envVar
 * in src/lib/stripe.ts.
 */
export const AMOUNTS = [
  // Standard
  { productId: "casdey_standard", tier: "standard", lookupKey: "casdey_standard_eur_month", currency: "eur", interval: "month", amount: 9_900,   envVar: "STRIPE_PRICE_STANDARD_EUR_MONTH", label: "Standard €99 / month" },
  { productId: "casdey_standard", tier: "standard", lookupKey: "casdey_standard_eur_year",  currency: "eur", interval: "year",  amount: 99_000,  envVar: "STRIPE_PRICE_STANDARD_EUR_YEAR",  label: "Standard €990 / year" },
  { productId: "casdey_standard", tier: "standard", lookupKey: "casdey_standard_gbp_month", currency: "gbp", interval: "month", amount: 8_900,   envVar: "STRIPE_PRICE_STANDARD_GBP_MONTH", label: "Standard £89 / month" },
  { productId: "casdey_standard", tier: "standard", lookupKey: "casdey_standard_gbp_year",  currency: "gbp", interval: "year",  amount: 89_000,  envVar: "STRIPE_PRICE_STANDARD_GBP_YEAR",  label: "Standard £890 / year" },
  // Pro
  { productId: "casdey_pro", tier: "pro", lookupKey: "casdey_pro_eur_month", currency: "eur", interval: "month", amount: 28_900,  envVar: "STRIPE_PRICE_PRO_EUR_MONTH", label: "Pro €289 / month" },
  { productId: "casdey_pro", tier: "pro", lookupKey: "casdey_pro_eur_year",  currency: "eur", interval: "year",  amount: 289_000, envVar: "STRIPE_PRICE_PRO_EUR_YEAR",  label: "Pro €2,890 / year" },
  { productId: "casdey_pro", tier: "pro", lookupKey: "casdey_pro_gbp_month", currency: "gbp", interval: "month", amount: 24_900,  envVar: "STRIPE_PRICE_PRO_GBP_MONTH", label: "Pro £249 / month" },
  { productId: "casdey_pro", tier: "pro", lookupKey: "casdey_pro_gbp_year",  currency: "gbp", interval: "year",  amount: 249_000, envVar: "STRIPE_PRICE_PRO_GBP_YEAR",  label: "Pro £2,490 / year" },
];

/**
 * The lifetime early-adopter discount: a single flat 20% percent-off coupon.
 * Currency-agnostic (unlike a fixed-amount coupon) so one coupon covers both
 * currencies and both paid tiers. `duration: forever` is what makes it
 * lifetime: once applied to a subscription it never stops.
 */
export const COUPON = {
  id: "casdey_early_20pct",
  percent_off: 20,
  duration: "forever",
  envVar: "STRIPE_COUPON_PERCENT",
  label: "20% off, forever (early adopter)",
};

/** Reads .env-style files with no dependency and no quote gymnastics. */
export function readEnvFile(file, fs) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
