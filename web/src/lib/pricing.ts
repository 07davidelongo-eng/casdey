import type { Currency } from "./countries";
import type { PlanTier } from "./types";

/**
 * The price catalogue and the public feature matrix.
 *
 * This used to live in stripe.ts, which is server-only, so nothing rendered
 * to a visitor could read it. The public pricing page needs the same figures
 * the checkout charges, and two copies of a price list is how a site ends up
 * advertising a number the card is not charged. So the data moved here, with
 * no server-only marker, and stripe.ts re-exports it for the checkout and
 * billing paths that were already using it.
 *
 * casdey's market is Europe, so prices lead in EUR; GBP keeps its own round
 * numbers for the UK, not a live conversion. See SAAS_V1_PLAN.md §F0.
 *
 *   Standard  €99/mo   (£89)    €990/yr    (£890)    — email win-back + at-risk
 *   Pro       €289/mo  (£249)   €2,890/yr  (£2,490)  — + WhatsApp + guarantee
 *
 * Annual is "two months free": ten times the monthly rate, billed once.
 *
 * The free week that precedes a paid tier is casdey's to give and never
 * touches Stripe (see plan.ts). A gym flagged early_adopter carries a
 * lifetime 20% discount on either paid tier.
 */

export type PlanInterval = "month" | "year";

export type PricePlan = {
  tier: PlanTier;
  currency: Currency;
  interval: PlanInterval;
  /** Effective per-month figure, which is the number a gym compares. */
  monthlyDisplay: string;
  /** What actually leaves the account, and how often. */
  chargeDisplay: string;
  /** STRIPE_PRICE_<TIER>_<CURRENCY>_<INTERVAL> — the id lives in the env, not
   *  here, because test-mode and live-mode ids differ. */
  envVar: string;
};

export const PRICE_PLANS: PricePlan[] = [
  // Standard
  {
    tier: "standard",
    currency: "eur",
    interval: "month",
    monthlyDisplay: "€99",
    chargeDisplay: "€99 a month",
    envVar: "STRIPE_PRICE_STANDARD_EUR_MONTH",
  },
  {
    tier: "standard",
    currency: "eur",
    interval: "year",
    monthlyDisplay: "€83",
    chargeDisplay: "€990 a year",
    envVar: "STRIPE_PRICE_STANDARD_EUR_YEAR",
  },
  {
    tier: "standard",
    currency: "gbp",
    interval: "month",
    monthlyDisplay: "£89",
    chargeDisplay: "£89 a month",
    envVar: "STRIPE_PRICE_STANDARD_GBP_MONTH",
  },
  {
    tier: "standard",
    currency: "gbp",
    interval: "year",
    monthlyDisplay: "£74",
    chargeDisplay: "£890 a year",
    envVar: "STRIPE_PRICE_STANDARD_GBP_YEAR",
  },
  // Pro
  {
    tier: "pro",
    currency: "eur",
    interval: "month",
    monthlyDisplay: "€289",
    chargeDisplay: "€289 a month",
    envVar: "STRIPE_PRICE_PRO_EUR_MONTH",
  },
  {
    tier: "pro",
    currency: "eur",
    interval: "year",
    monthlyDisplay: "€241",
    chargeDisplay: "€2,890 a year",
    envVar: "STRIPE_PRICE_PRO_EUR_YEAR",
  },
  {
    tier: "pro",
    currency: "gbp",
    interval: "month",
    monthlyDisplay: "£249",
    chargeDisplay: "£249 a month",
    envVar: "STRIPE_PRICE_PRO_GBP_MONTH",
  },
  {
    tier: "pro",
    currency: "gbp",
    interval: "year",
    monthlyDisplay: "£207",
    chargeDisplay: "£2,490 a year",
    envVar: "STRIPE_PRICE_PRO_GBP_YEAR",
  },
];

/** The month + year options for one tier in one currency. */
export function pricePlansFor(tier: PlanTier, currency: Currency): PricePlan[] {
  return PRICE_PLANS.filter((p) => p.tier === tier && p.currency === currency);
}

export function findPricePlan(
  tier: PlanTier,
  currency: Currency,
  interval: PlanInterval,
): PricePlan | undefined {
  return PRICE_PLANS.find(
    (p) =>
      p.tier === tier && p.currency === currency && p.interval === interval,
  );
}

/* ------------------------------------------------------------------ */
/* The public comparison                                               */
/* ------------------------------------------------------------------ */

/** The three columns a visitor compares. Free is a plan, not a trial. */
export type PublicTier = "free" | "standard" | "pro";

export const TIER_ORDER: PublicTier[] = ["free", "standard", "pro"];

export const TIER_NAMES: Record<PublicTier, string> = {
  free: "Free",
  standard: "Standard",
  pro: "Pro",
};

export const TIER_LINES: Record<PublicTier, string> = {
  free: "Find who stopped coming and see what they are worth. It will not send for you.",
  standard:
    "The win-back loop over email, running on its own in your gym's name.",
  pro: "Everything, plus WhatsApp and the guarantee that it pays for itself.",
};

/**
 * Every row is checked against src/lib/plan.ts rather than written from the
 * pitch. A marketing page that promises a capability the code gates is worse
 * than a page that promises less.
 */
export type FeatureRow = {
  label: string;
  /** true / false for a plain grant, or a string where the answer is a figure. */
  free: boolean | string;
  standard: boolean | string;
  pro: boolean | string;
  note?: string;
};

export const FEATURE_ROWS: FeatureRow[] = [
  {
    label: "Import your member list",
    note: "A file from your gym software, or a CSV",
    free: true,
    standard: true,
    pro: true,
  },
  {
    label: "See who has lapsed, and what the quiet list is worth",
    free: true,
    standard: true,
    pro: true,
  },
  {
    label: "Members you can hold",
    free: "50",
    standard: "200",
    pro: "2,000",
  },
  {
    label: "Members shown by name",
    note: "The true total is always shown, on every plan",
    free: "First 5",
    standard: "All",
    pro: "All",
  },
  {
    label: "Export everything, whenever you want",
    note: "Never capped. It is your data",
    free: true,
    standard: true,
    pro: true,
  },
  {
    label: "Email win-back campaigns",
    free: false,
    standard: true,
    pro: true,
  },
  {
    label: "At-risk check-ins",
    note: "For the regular who has gone quiet but has not lapsed yet",
    free: false,
    standard: true,
    pro: true,
  },
  {
    label: "Sends from your own gym's domain",
    free: false,
    standard: true,
    pro: true,
  },
  {
    label: "Replies answered in your name, and booked into your calendar",
    free: false,
    standard: true,
    pro: true,
  },
  {
    label: "WhatsApp channel",
    note: "From your gym's own WhatsApp number",
    free: false,
    standard: false,
    pro: true,
  },
  {
    label: "Profit-or-nothing guarantee",
    note: "One 30-day window, refundable in full if it does not pay for itself",
    free: false,
    standard: false,
    pro: true,
  },
];
