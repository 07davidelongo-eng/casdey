import "server-only";

import { supabaseAdmin } from "./supabase";
import { stripeClient } from "./stripe";
import { effectivePlan, type Plan } from "./plan";
import { change } from "./dashboard";
import type { Gym } from "./types";

/**
 * The founder-facing numbers for /admin: the Shopify-style "how is the
 * business doing" view, as distinct from a gym's own dashboard in
 * src/app/app/page.tsx, which is scoped to one gym's members and campaigns.
 *
 * Two kinds of number live here, and they are sourced differently on purpose:
 *
 *   - Money (MRR, guarantee payouts) is read from Stripe and from
 *     subscription_payments/guarantee_claims, never re-derived from a price
 *     catalogue. A hand-entered catalogue is exactly the seam that produced
 *     the 2026-09-04 webhook price-lookup bug (see CLAUDE.md "A revenue bug
 *     in that hand-entry seam") and the 2026-09-07 apex-webhook outage: our
 *     own columns are not proof of what is actually being charged.
 *   - Everything else (signups, plan mix, churn) is counted straight from
 *     casdey's own tables, the same "no summary table to drift out of step"
 *     rule src/lib/dashboard.ts already follows.
 *
 * What this file does NOT cover: visitor counts and the marketing/checkout
 * funnel. Casdey's own tables have no idea how many people looked at the
 * pricing page before signing up, or how many started a Stripe Checkout and
 * abandoned it. That half needs an actual analytics tool (PostHog EU,
 * cookieless — see the 2026-09-08 planning note) and is deliberately not
 * faked here with a number this file cannot honestly produce.
 *
 * Every query here excludes gyms.is_internal (migration 0035, 2026-09-08):
 * casdey's own dev/QA gyms live in the same table real customers do, because
 * local development points at the same Supabase project as production. Found
 * the hard way: this page counted three test-mode Stripe subscriptions from
 * feature stress-tests, plus Davide's own live-mode test account from the
 * 2026-09-07 V1 walkthrough, as four paying customers.
 */

/** Monday of the week containing this date, in UTC. Same rule as
 *  src/lib/dashboard.ts's weekStartOf, kept local rather than exported from
 *  there: that file is gym-scoped and this one is cross-gym. */
function weekStartOf(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const WEEK_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/* ------------------------------------------------------------------ */
/* Signups: waitlist and real gyms, week by week                       */
/* ------------------------------------------------------------------ */

export type SignupWeek = {
  weekStart: string;
  label: string;
  waitlist: number;
  gyms: number;
};

export type SignupTrend = {
  current: SignupWeek[];
  previous: SignupWeek[];
  totals: { waitlist: number; gyms: number };
  previousTotals: { waitlist: number; gyms: number };
  changeWaitlist: number | null;
  changeGyms: number | null;
};

/** Waitlist joins and gym signups, the last `weeks` weeks against the
 *  `weeks` before them. Mirrors activityWithComparison() in dashboard.ts. */
export async function signupTrend(
  weeks = 12,
  now: Date = new Date(),
): Promise<SignupTrend> {
  const supabase = supabaseAdmin();
  const totalWeeks = weeks * 2;
  const thisWeek = weekStartOf(now);
  const from = new Date(thisWeek);
  from.setUTCDate(from.getUTCDate() - (totalWeeks - 1) * 7);
  const fromIso = from.toISOString();

  const buckets = new Map<string, SignupWeek>();
  for (let i = 0; i < totalWeeks; i += 1) {
    const start = new Date(from);
    start.setUTCDate(start.getUTCDate() + i * 7);
    buckets.set(dayKey(start), {
      weekStart: dayKey(start),
      label: WEEK_LABEL.format(start),
      waitlist: 0,
      gyms: 0,
    });
  }

  const [waitlist, gyms] = await Promise.all([
    supabase.from("waitlist_signups").select("created_at").gte("created_at", fromIso),
    supabase
      .from("gyms")
      .select("created_at")
      .eq("is_internal", false)
      .gte("created_at", fromIso),
  ]);

  if (waitlist.error) {
    console.error("[admin-stats] waitlist signup lookup failed", waitlist.error.message);
  }
  if (gyms.error) {
    console.error("[admin-stats] gym signup lookup failed", gyms.error.message);
  }

  for (const row of waitlist.data ?? []) {
    const bucket = buckets.get(dayKey(weekStartOf(new Date(row.created_at as string))));
    if (bucket) bucket.waitlist += 1;
  }
  for (const row of gyms.data ?? []) {
    const bucket = buckets.get(dayKey(weekStartOf(new Date(row.created_at as string))));
    if (bucket) bucket.gyms += 1;
  }

  const all = [...buckets.values()];
  const current = all.slice(weeks);
  const previous = all.slice(0, weeks);
  const sum = (arr: SignupWeek[], key: "waitlist" | "gyms") =>
    arr.reduce((total, week) => total + week[key], 0);

  const totals = { waitlist: sum(current, "waitlist"), gyms: sum(current, "gyms") };
  const previousTotals = { waitlist: sum(previous, "waitlist"), gyms: sum(previous, "gyms") };

  return {
    current,
    previous,
    totals,
    previousTotals,
    changeWaitlist: change(totals.waitlist, previousTotals.waitlist),
    changeGyms: change(totals.gyms, previousTotals.gyms),
  };
}

/* ------------------------------------------------------------------ */
/* Plan mix: every gym, by what it actually has access to right now    */
/* ------------------------------------------------------------------ */

export type PlanCounts = Record<Plan, number>;

/** How many gyms sit in each plan state right now. Uses effectivePlan(), the
 *  same derivation the product itself gates on, so this can never disagree
 *  with what a gym actually sees when it signs in. */
export async function planBreakdown(
  now: Date = new Date(),
): Promise<{ counts: PlanCounts; total: number }> {
  const { data, error } = await supabaseAdmin()
    .from("gyms")
    .select("subscription_status, trial_ends_at, plan_tier")
    .eq("is_internal", false);

  const counts: PlanCounts = { trial: 0, free: 0, standard: 0, pro: 0 };

  if (error) {
    console.error("[admin-stats] plan breakdown failed", error.message);
    return { counts, total: 0 };
  }

  for (const row of data ?? []) {
    const plan = effectivePlan(
      row as Pick<Gym, "subscription_status" | "trial_ends_at" | "plan_tier">,
      now,
    );
    counts[plan] += 1;
  }

  return { counts, total: data?.length ?? 0 };
}

/* ------------------------------------------------------------------ */
/* MRR: read from Stripe, never re-derived from the price catalogue    */
/* ------------------------------------------------------------------ */

export type MrrByCurrency = { eur: number; gbp: number };

/** The early-adopter coupon's live percent-off, read from Stripe rather than
 *  assumed to still be 20: a coupon can be edited in the dashboard without a
 *  code change, and this number gets multiplied into real revenue figures. */
async function earlyAdopterDiscountFraction(): Promise<number> {
  const couponId = process.env.STRIPE_COUPON_PERCENT;
  if (!couponId) return 0;
  try {
    const coupon = await stripeClient().coupons.retrieve(couponId);
    return (coupon.percent_off ?? 0) / 100;
  } catch (error) {
    console.error("[admin-stats] could not read early-adopter coupon", error);
    return 0;
  }
}

/**
 * Monthly recurring revenue, net of the early-adopter discount, split by
 * currency (never blended into one figure with a made-up exchange rate, the
 * same rule pricing.ts follows for the public price list).
 *
 * Reads each paying gym's live Stripe subscription rather than trusting
 * gyms.plan_tier/plan_currency: those columns are written by the webhook and
 * have already been wrong once in production (see the 2026-09-04 price
 * lookup bug and the 2026-09-07 apex-redirect outage in CLAUDE.md). A handful
 * of paying gyms at casdey's current scale makes one Stripe call each cheap.
 */
export async function mrr(): Promise<MrrByCurrency> {
  const { data: gyms, error } = await supabaseAdmin()
    .from("gyms")
    .select("id, stripe_subscription_id, early_adopter")
    .eq("is_internal", false)
    .in("subscription_status", ["active", "past_due"])
    .not("stripe_subscription_id", "is", null);

  const totals: MrrByCurrency = { eur: 0, gbp: 0 };

  if (error) {
    console.error("[admin-stats] mrr lookup failed", error.message);
    return totals;
  }
  if (!gyms || gyms.length === 0) return totals;

  const [discount, subscriptions] = await Promise.all([
    earlyAdopterDiscountFraction(),
    Promise.all(
      gyms.map((gym) =>
        stripeClient()
          .subscriptions.retrieve(gym.stripe_subscription_id as string)
          .catch((err) => {
            console.error(
              `[admin-stats] could not read Stripe subscription for gym ${gym.id}`,
              err,
            );
            return null;
          }),
      ),
    ),
  ]);

  subscriptions.forEach((subscription, index) => {
    if (!subscription) return;
    const gym = gyms[index];
    const multiplier = gym.early_adopter ? 1 - discount : 1;

    for (const item of subscription.items.data) {
      const price = item.price;
      const currency = price.currency;
      if (currency !== "eur" && currency !== "gbp") continue;
      const interval = price.recurring?.interval;
      const divisor = interval === "year" ? 12 : interval === "month" ? 1 : null;
      if (!divisor || price.unit_amount == null) continue;
      totals[currency] +=
        (price.unit_amount * (item.quantity ?? 1) * multiplier) / divisor;
    }
  });

  return { eur: Math.round(totals.eur), gbp: Math.round(totals.gbp) };
}

/* ------------------------------------------------------------------ */
/* Churn: gyms whose subscription has actually ended                   */
/* ------------------------------------------------------------------ */

export type ChurnSummary = { current: number; previous: number };

/** How many gyms went to `canceled` in the last `weeks` weeks, against the
 *  `weeks` before. Uses updated_at as the moment of cancellation: the
 *  gyms_touch trigger bumps it on every write, and the webhook is the only
 *  thing that flips subscription_status, so it is a fair proxy without a
 *  dedicated events table. */
export async function churnSummary(
  weeks = 12,
  now: Date = new Date(),
): Promise<ChurnSummary> {
  const currentFrom = new Date(now);
  currentFrom.setUTCDate(currentFrom.getUTCDate() - weeks * 7);
  const previousFrom = new Date(currentFrom);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - weeks * 7);

  const { data, error } = await supabaseAdmin()
    .from("gyms")
    .select("updated_at")
    .eq("is_internal", false)
    .eq("subscription_status", "canceled")
    .gte("updated_at", previousFrom.toISOString());

  if (error) {
    console.error("[admin-stats] churn lookup failed", error.message);
    return { current: 0, previous: 0 };
  }

  let current = 0;
  let previous = 0;
  for (const row of data ?? []) {
    const at = new Date(row.updated_at as string).getTime();
    if (at >= currentFrom.getTime()) current += 1;
    else previous += 1;
  }
  return { current, previous };
}

/* ------------------------------------------------------------------ */
/* The profit-or-nothing guarantee                                     */
/* ------------------------------------------------------------------ */

export type GuaranteeSummary = {
  totalClaims: number;
  pendingClaims: number;
  refundedByCurrency: MrrByCurrency;
};

/** Every guarantee claim ever filed, and what it actually cost casdey. A
 *  gym's currency is read from its current plan_currency: casdey has never
 *  had a gym switch currency mid-life, so this is exact, not a guess. */
export async function guaranteeSummary(): Promise<GuaranteeSummary> {
  const { data, error } = await supabaseAdmin()
    .from("guarantee_claims")
    // !inner so the is_internal filter below actually excludes the row,
    // rather than just nulling out the embed on a left join.
    .select("status, refunded_minor, gyms!inner(plan_currency, is_internal)")
    .eq("gyms.is_internal", false);

  const refundedByCurrency: MrrByCurrency = { eur: 0, gbp: 0 };

  if (error) {
    console.error("[admin-stats] guarantee lookup failed", error.message);
    return { totalClaims: 0, pendingClaims: 0, refundedByCurrency };
  }

  let pendingClaims = 0;
  for (const row of data ?? []) {
    const gymRow = Array.isArray(row.gyms) ? row.gyms[0] : row.gyms;
    const currency = gymRow?.plan_currency as "eur" | "gbp" | null | undefined;
    if (currency) refundedByCurrency[currency] += (row.refunded_minor as number) ?? 0;
    if (row.status === "processing") pendingClaims += 1;
  }

  return { totalClaims: data?.length ?? 0, pendingClaims, refundedByCurrency };
}
