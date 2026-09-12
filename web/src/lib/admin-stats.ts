import "server-only";

import { supabaseAdmin } from "./supabase";
import { stripeClient } from "./stripe";
import { effectivePlan, type Plan } from "./plan";
import { change } from "./dashboard";
import { bucketKeyFor, periodBuckets, type PeriodPoint } from "./admin-period";
import { gymCurrency } from "./money";
import type { Gym } from "./types";

/**
 * The founder-facing numbers for /admin: the Shopify/Baremetrics-style "how is
 * the business doing" view, as distinct from a gym's own dashboard in
 * src/app/app/page.tsx, which is scoped to one gym's members and campaigns.
 *
 * Two kinds of number live here, and they are sourced differently on purpose:
 *
 *   - Money (MRR, revenue collected, guarantee payouts) is read from Stripe
 *     and from subscription_payments/guarantee_claims, never re-derived from a
 *     price catalogue. A hand-entered catalogue is exactly the seam that
 *     produced the 2026-09-04 webhook price-lookup bug (see CLAUDE.md "A
 *     revenue bug in that hand-entry seam") and the 2026-09-07 apex-webhook
 *     outage: our own columns are not proof of what is actually being charged.
 *   - Everything else (signups, plan mix, churn, activation) is counted
 *     straight from casdey's own tables, the same "no summary table to drift
 *     out of step" rule src/lib/dashboard.ts already follows.
 *
 * The visitor/traffic half lives in src/lib/posthog-query.ts: casdey's own
 * tables cannot say how many people looked at the pricing page, so that half
 * comes from PostHog and comes back null (never a fake zero) when PostHog is
 * unreachable.
 *
 * Every query here excludes gyms.is_internal (migration 0035, 2026-09-08):
 * casdey's own dev/QA gyms live in the same table real customers do, because
 * local development points at the same Supabase project as production. Found
 * the hard way: this page counted three test-mode Stripe subscriptions from
 * feature stress-tests, plus Davide's own live-mode test account from the
 * 2026-09-07 V1 walkthrough, as four paying customers.
 *
 * Money is always split by currency, never blended into one figure with a
 * made-up exchange rate — the same rule pricing.ts follows for the public
 * price list.
 */

export type MoneyByCurrency = { eur: number; gbp: number };
/** @deprecated older name, kept so callers do not all churn at once. */
export type MrrByCurrency = MoneyByCurrency;

const ZERO_MONEY: MoneyByCurrency = { eur: 0, gbp: 0 };

/** Whole days back from now, with the trend charts grouping by day or week.
 *  The URL → these values mapping lives in src/app/admin/parts.tsx. */
type Bucket = "day" | "week";
const DEFAULT_DAYS = 84;

/** The ids of every gym that is a real (non-internal) customer. Passed into
 *  the cross-table counts below so an `in("gym_id", …)` filter does the
 *  is_internal exclusion without a fragile embedded-resource head count. */
export async function nonInternalGymIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("gyms")
    .select("id")
    .eq("is_internal", false);

  if (error) {
    console.error("[admin-stats] gym id lookup failed", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.id as string);
}

/** The mirror of nonInternalGymIds: casdey's own dev/QA gyms. Only the
 *  "Test & dev" section uses this. */
export async function internalGymIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("gyms")
    .select("id")
    .eq("is_internal", true);

  if (error) {
    console.error("[admin-stats] internal gym id lookup failed", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.id as string);
}

/* ------------------------------------------------------------------ */
/* Signups: real gyms, over the period (the waitlist is retired now    */
/* that casdey.com is published — see the 2026-09-08 note)             */
/* ------------------------------------------------------------------ */

export type SignupBucket = { key: string; label: string; gyms: number };

export type SignupTrend = {
  current: SignupBucket[];
  previous: SignupBucket[];
  total: number;
  previousTotal: number;
  changePercent: number | null;
};

/** Gym signups over the period, against the same length before it, grouped by
 *  `bucket`. Mirrors activityWithComparison() in dashboard.ts. */
export async function gymSignupTrend(
  days = DEFAULT_DAYS,
  bucket: Bucket = "week",
  now: Date = new Date(),
): Promise<SignupTrend> {
  const supabase = supabaseAdmin();
  const { all, perSide } = periodBuckets(days, bucket, now);

  const { data, error } = await supabase
    .from("gyms")
    .select("created_at")
    .eq("is_internal", false)
    .gte("created_at", all[0]?.key ?? new Date(0).toISOString());

  if (error) {
    console.error("[admin-stats] gym signup lookup failed", error.message);
  }

  const counts = new Map<string, number>(all.map((b) => [b.key, 0]));
  for (const row of data ?? []) {
    const k = bucketKeyFor(row.created_at as string, bucket);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const merged: SignupBucket[] = all.map((b: PeriodPoint) => ({
    key: b.key,
    label: b.label,
    gyms: counts.get(b.key) ?? 0,
  }));
  const current = merged.slice(perSide);
  const previous = merged.slice(0, perSide);
  const sum = (arr: SignupBucket[]) => arr.reduce((t, w) => t + w.gyms, 0);
  const total = sum(current);
  const previousTotal = sum(previous);

  return {
    current,
    previous,
    total,
    previousTotal,
    changePercent: change(total, previousTotal),
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

export type Mrr = {
  byCurrency: MoneyByCurrency;
  /** Paying gyms whose subscription is in that currency. */
  gymsByCurrency: MoneyByCurrency;
  payingGyms: number;
};

/**
 * Monthly recurring revenue, net of the early-adopter discount, split by
 * currency.
 *
 * Reads each paying gym's live Stripe subscription rather than trusting
 * gyms.plan_tier/plan_currency: those columns are written by the webhook and
 * have already been wrong once in production (see the 2026-09-04 price lookup
 * bug and the 2026-09-07 apex-redirect outage in CLAUDE.md). A handful of
 * paying gyms at casdey's current scale makes one Stripe call each cheap.
 */
export async function mrr(): Promise<Mrr> {
  const { data: gyms, error } = await supabaseAdmin()
    .from("gyms")
    .select("id, stripe_subscription_id, early_adopter")
    .eq("is_internal", false)
    .in("subscription_status", ["active", "past_due"])
    .not("stripe_subscription_id", "is", null);

  const empty: Mrr = {
    byCurrency: { ...ZERO_MONEY },
    gymsByCurrency: { ...ZERO_MONEY },
    payingGyms: 0,
  };

  if (error) {
    console.error("[admin-stats] mrr lookup failed", error.message);
    return empty;
  }
  if (!gyms || gyms.length === 0) return empty;

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

  const byCurrency: MoneyByCurrency = { ...ZERO_MONEY };
  const gymsByCurrency: MoneyByCurrency = { ...ZERO_MONEY };
  let payingGyms = 0;

  subscriptions.forEach((subscription, index) => {
    if (!subscription) return;
    const gym = gyms[index];
    const multiplier = gym.early_adopter ? 1 - discount : 1;
    let counted = false;

    for (const item of subscription.items.data) {
      const price = item.price;
      const currency = price.currency;
      if (currency !== "eur" && currency !== "gbp") continue;
      const interval = price.recurring?.interval;
      const divisor = interval === "year" ? 12 : interval === "month" ? 1 : null;
      if (!divisor || price.unit_amount == null) continue;
      byCurrency[currency] +=
        (price.unit_amount * (item.quantity ?? 1) * multiplier) / divisor;
      if (!counted) {
        gymsByCurrency[currency] += 1;
        counted = true;
      }
    }
    if (counted) payingGyms += 1;
  });

  return {
    byCurrency: {
      eur: Math.round(byCurrency.eur),
      gbp: Math.round(byCurrency.gbp),
    },
    gymsByCurrency,
    payingGyms,
  };
}

/* ------------------------------------------------------------------ */
/* Cash actually collected, from subscription_payments (webhook truth) */
/* ------------------------------------------------------------------ */

export type RevenueCollected = {
  windowGross: MoneyByCurrency;
  windowRefunded: MoneyByCurrency;
  windowNet: MoneyByCurrency;
  previousNet: MoneyByCurrency;
  allTimeGross: MoneyByCurrency;
  allTimeNet: MoneyByCurrency;
  changeNet: { eur: number | null; gbp: number | null };
};

/**
 * Real cash in, from the subscription_payments rows the invoice.paid webhook
 * writes — one row per paid Stripe invoice, with what it charged and what has
 * since been refunded against it. "Net" is gross minus refunds (guarantee
 * payouts land here as refunded_minor), so it is the number that actually
 * hit casdey's account.
 */
export async function revenueCollected(
  gymIds: string[],
  days = DEFAULT_DAYS,
  now: Date = new Date(),
): Promise<RevenueCollected> {
  const empty: RevenueCollected = {
    windowGross: { ...ZERO_MONEY },
    windowRefunded: { ...ZERO_MONEY },
    windowNet: { ...ZERO_MONEY },
    previousNet: { ...ZERO_MONEY },
    allTimeGross: { ...ZERO_MONEY },
    allTimeNet: { ...ZERO_MONEY },
    changeNet: { eur: null, gbp: null },
  };
  if (gymIds.length === 0) return empty;

  const { data, error } = await supabaseAdmin()
    .from("subscription_payments")
    .select("amount_minor, refunded_minor, currency, paid_at")
    .in("gym_id", gymIds);

  if (error) {
    console.error("[admin-stats] revenue collected lookup failed", error.message);
    return empty;
  }

  const windowFrom = new Date(now);
  windowFrom.setUTCDate(windowFrom.getUTCDate() - days);
  const previousFrom = new Date(windowFrom);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days);

  const result: RevenueCollected = {
    windowGross: { ...ZERO_MONEY },
    windowRefunded: { ...ZERO_MONEY },
    windowNet: { ...ZERO_MONEY },
    previousNet: { ...ZERO_MONEY },
    allTimeGross: { ...ZERO_MONEY },
    allTimeNet: { ...ZERO_MONEY },
    changeNet: { eur: null, gbp: null },
  };

  for (const row of data ?? []) {
    const currency = row.currency as "eur" | "gbp";
    if (currency !== "eur" && currency !== "gbp") continue;
    const gross = (row.amount_minor as number) ?? 0;
    const refunded = (row.refunded_minor as number) ?? 0;
    const net = gross - refunded;
    const paidAt = new Date(row.paid_at as string);

    result.allTimeGross[currency] += gross;
    result.allTimeNet[currency] += net;

    if (paidAt >= windowFrom) {
      result.windowGross[currency] += gross;
      result.windowRefunded[currency] += refunded;
      result.windowNet[currency] += net;
    } else if (paidAt >= previousFrom) {
      result.previousNet[currency] += net;
    }
  }

  result.changeNet = {
    eur: change(result.windowNet.eur, result.previousNet.eur),
    gbp: change(result.windowNet.gbp, result.previousNet.gbp),
  };
  return result;
}

/* ------------------------------------------------------------------ */
/* Subscription health and trial conversion                            */
/* ------------------------------------------------------------------ */

export type SubscriptionHealth = {
  statusCounts: {
    active: number;
    trial: number;
    pastDue: number;
    canceled: number;
    free: number;
  };
  activeByCurrency: MoneyByCurrency;
  /** Cancelled but still inside the paid period (cancels_at in the future). */
  scheduledCancellations: number;
  /** Trials whose free week ends within 7 days. */
  trialsEndingSoon: number;
  /** Every gym that has ever been given a trial. */
  trialsEverStarted: number;
  /** …of which, how many are paying now. */
  trialsConverted: number;
  trialConversionRate: number | null;
};

export async function subscriptionHealth(
  now: Date = new Date(),
): Promise<SubscriptionHealth> {
  const empty: SubscriptionHealth = {
    statusCounts: { active: 0, trial: 0, pastDue: 0, canceled: 0, free: 0 },
    activeByCurrency: { ...ZERO_MONEY },
    scheduledCancellations: 0,
    trialsEndingSoon: 0,
    trialsEverStarted: 0,
    trialsConverted: 0,
    trialConversionRate: null,
  };

  const { data, error } = await supabaseAdmin()
    .from("gyms")
    .select(
      "subscription_status, plan_tier, plan_currency, trial_ends_at, cancels_at",
    )
    .eq("is_internal", false);

  if (error) {
    console.error("[admin-stats] subscription health lookup failed", error.message);
    return empty;
  }

  const result: SubscriptionHealth = {
    statusCounts: { active: 0, trial: 0, pastDue: 0, canceled: 0, free: 0 },
    activeByCurrency: { ...ZERO_MONEY },
    scheduledCancellations: 0,
    trialsEndingSoon: 0,
    trialsEverStarted: 0,
    trialsConverted: 0,
    trialConversionRate: null,
  };

  const soon = new Date(now);
  soon.setUTCDate(soon.getUTCDate() + 7);

  for (const row of data ?? []) {
    const status = row.subscription_status as Gym["subscription_status"];
    const plan = effectivePlan(
      row as Pick<Gym, "subscription_status" | "trial_ends_at" | "plan_tier">,
      now,
    );
    // `incomplete` is a subscription whose payment is waiting on the gym's bank
    // (3-D Secure). It used to fall through to "free" here, which understated
    // what was coming in and hid exactly the gyms worth a nudge. It counts as
    // subscribed, and sits with past_due as "awaiting payment": both are a
    // subscription that has not collected yet.
    const paying =
      status === "active" || status === "past_due" || status === "incomplete";

    if (plan === "trial") result.statusCounts.trial += 1;
    else if (status === "active") result.statusCounts.active += 1;
    else if (status === "past_due" || status === "incomplete")
      result.statusCounts.pastDue += 1;
    else if (status === "canceled") result.statusCounts.canceled += 1;
    else result.statusCounts.free += 1;

    if (paying) {
      const currency = row.plan_currency as "eur" | "gbp" | null;
      if (currency === "eur" || currency === "gbp") {
        result.activeByCurrency[currency] += 1;
      }
    }

    const cancelsAt = row.cancels_at
      ? new Date(row.cancels_at as string)
      : null;
    if (cancelsAt && cancelsAt > now && paying) {
      result.scheduledCancellations += 1;
    }

    const trialEndsAt = row.trial_ends_at
      ? new Date(row.trial_ends_at as string)
      : null;
    if (trialEndsAt) {
      result.trialsEverStarted += 1;
      if (paying) result.trialsConverted += 1;
      if (plan === "trial" && trialEndsAt <= soon && trialEndsAt > now) {
        result.trialsEndingSoon += 1;
      }
    }
  }

  result.trialConversionRate =
    result.trialsEverStarted === 0
      ? null
      : Math.round((result.trialsConverted / result.trialsEverStarted) * 100);

  return result;
}

/* ------------------------------------------------------------------ */
/* Churn: gyms whose subscription has actually ended                   */
/* ------------------------------------------------------------------ */

export type ChurnSummary = { current: number; previous: number };

/** How many gyms went to `canceled` in the last `days` days, against the
 *  `days` before. Uses updated_at as the moment of cancellation: the
 *  gyms_touch trigger bumps it on every write, and the webhook is the only
 *  thing that flips subscription_status, so it is a fair proxy without a
 *  dedicated events table. */
export async function churnSummary(
  days = DEFAULT_DAYS,
  now: Date = new Date(),
): Promise<ChurnSummary> {
  const currentFrom = new Date(now);
  currentFrom.setUTCDate(currentFrom.getUTCDate() - days);
  const previousFrom = new Date(currentFrom);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days);

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
/* Activation: how far each gym has got through first-run setup        */
/* ------------------------------------------------------------------ */

export type ActivationFunnel = {
  signedUp: number;
  importedMembers: number;
  pricedService: number;
  choseOffer: number;
  approvedCampaign: number;
  paying: number;
};

/**
 * The share of gyms that have reached each setup step. Counts are independent
 * ("has done this at all"), not strictly nested, so a gym that priced a
 * service before importing still shows in both — the setup checklist nudges a
 * rough order but does not enforce one.
 */
export async function activationFunnel(
  gymIds: string[],
): Promise<ActivationFunnel> {
  const zero: ActivationFunnel = {
    signedUp: 0,
    importedMembers: 0,
    pricedService: 0,
    choseOffer: 0,
    approvedCampaign: 0,
    paying: 0,
  };
  if (gymIds.length === 0) return zero;

  const supabase = supabaseAdmin();

  const { data: gyms, error } = await supabase
    .from("gyms")
    .select("id, subscription_status, offer_text")
    .in("id", gymIds);

  if (error) {
    console.error("[admin-stats] activation gyms lookup failed", error.message);
    return zero;
  }

  // One gym is a handful of head-count queries; casdey has tens of gyms, not
  // thousands (the Resend domain cap alone holds it near ten), so N small
  // "does this gym have any X" probes is fine here. Move to an RPC if that
  // ever stops being true.
  const perGym = await Promise.all(
    (gyms ?? []).map(async (gym) => {
      const id = gym.id as string;
      const [members, services, campaigns] = await Promise.all([
        supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", id)
          .eq("is_test", false),
        supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", id)
          .eq("active", true)
          .gt("price_minor", 0),
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", id)
          .not("approved_at", "is", null),
      ]);
      return {
        members: (members.count ?? 0) > 0,
        priced: (services.count ?? 0) > 0,
        campaign: (campaigns.count ?? 0) > 0,
        offer: Boolean(gym.offer_text),
        paying:
          gym.subscription_status === "active" ||
          gym.subscription_status === "past_due" ||
          gym.subscription_status === "incomplete",
      };
    }),
  );

  return {
    signedUp: perGym.length,
    importedMembers: perGym.filter((g) => g.members).length,
    pricedService: perGym.filter((g) => g.priced).length,
    choseOffer: perGym.filter((g) => g.offer).length,
    approvedCampaign: perGym.filter((g) => g.campaign).length,
    paying: perGym.filter((g) => g.paying).length,
  };
}

/* ------------------------------------------------------------------ */
/* Product reach: what casdey did for every gym, this period           */
/* ------------------------------------------------------------------ */

export type ProductReach = {
  membersManaged: number;
  membersReturned: { current: number; previous: number };
  campaignsApproved: { current: number; previous: number };
  messagesSent: { current: number; previous: number };
  bookings: { current: number; previous: number };
  revenueRecovered: { current: MoneyByCurrency; previous: MoneyByCurrency };
};

export async function productReach(
  gymIds: string[],
  days = DEFAULT_DAYS,
  now: Date = new Date(),
): Promise<ProductReach> {
  const zero: ProductReach = {
    membersManaged: 0,
    membersReturned: { current: 0, previous: 0 },
    campaignsApproved: { current: 0, previous: 0 },
    messagesSent: { current: 0, previous: 0 },
    bookings: { current: 0, previous: 0 },
    revenueRecovered: {
      current: { ...ZERO_MONEY },
      previous: { ...ZERO_MONEY },
    },
  };
  if (gymIds.length === 0) return zero;

  const supabase = supabaseAdmin();
  const windowFrom = new Date(now);
  windowFrom.setUTCDate(windowFrom.getUTCDate() - days);
  const previousFrom = new Date(windowFrom);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days);
  const wIso = windowFrom.toISOString();
  const pIso = previousFrom.toISOString();

  const num = (
    res: { count: number | null; error: { message: string } | null },
    label: string,
  ): number => {
    if (res.error) {
      console.error(`[admin-stats] ${label} count failed`, res.error.message);
      return 0;
    }
    return res.count ?? 0;
  };

  const recoveredIn = async (
    from: string,
    to: string | null,
  ): Promise<MoneyByCurrency> => {
    let q = supabase
      .from("bookings")
      .select("value_minor, gyms!inner(plan_currency, country)")
      .in("gym_id", gymIds)
      .in("status", ["booked", "completed"])
      .gte("created_at", from);
    if (to) q = q.lt("created_at", to);
    const { data, error } = await q;
    if (error) {
      console.error("[admin-stats] recovered revenue lookup failed", error.message);
      return { ...ZERO_MONEY };
    }
    const totals: MoneyByCurrency = { ...ZERO_MONEY };
    for (const row of data ?? []) {
      const gym = Array.isArray(row.gyms) ? row.gyms[0] : row.gyms;
      if (!gym) continue;
      const currency = gymCurrency(
        gym as Pick<Gym, "plan_currency" | "country">,
      );
      totals[currency] += (row.value_minor as number | null) ?? 0;
    }
    return totals;
  };

  const [
    membersManagedRes,
    returnedCurrentRes,
    returnedPreviousRes,
    campaignsCurrentRes,
    campaignsPreviousRes,
    messagesCurrentRes,
    messagesPreviousRes,
    bookingsCurrentRes,
    bookingsPreviousRes,
    revenueCurrent,
    revenuePrevious,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .eq("is_test", false),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .eq("is_test", false)
      .eq("status", "returned")
      .gte("returned_at", wIso),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .eq("is_test", false)
      .eq("status", "returned")
      .gte("returned_at", pIso)
      .lt("returned_at", wIso),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .not("approved_at", "is", null)
      .gte("approved_at", wIso),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .not("approved_at", "is", null)
      .gte("approved_at", pIso)
      .lt("approved_at", wIso),
    supabase
      .from("campaign_messages")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .eq("status", "sent")
      .gte("sent_at", wIso),
    supabase
      .from("campaign_messages")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .eq("status", "sent")
      .gte("sent_at", pIso)
      .lt("sent_at", wIso),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .in("status", ["booked", "completed"])
      .gte("created_at", wIso),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .in("status", ["booked", "completed"])
      .gte("created_at", pIso)
      .lt("created_at", wIso),
    recoveredIn(wIso, null),
    recoveredIn(pIso, wIso),
  ]);

  const membersManaged = num(membersManagedRes, "members managed");
  const returnedCurrent = num(returnedCurrentRes, "members returned");
  const returnedPrevious = num(returnedPreviousRes, "members returned (prev)");
  const campaignsCurrent = num(campaignsCurrentRes, "campaigns approved");
  const campaignsPrevious = num(campaignsPreviousRes, "campaigns approved (prev)");
  const messagesCurrent = num(messagesCurrentRes, "messages sent");
  const messagesPrevious = num(messagesPreviousRes, "messages sent (prev)");
  const bookingsCurrent = num(bookingsCurrentRes, "bookings");
  const bookingsPrevious = num(bookingsPreviousRes, "bookings (prev)");

  return {
    membersManaged,
    membersReturned: { current: returnedCurrent, previous: returnedPrevious },
    campaignsApproved: {
      current: campaignsCurrent,
      previous: campaignsPrevious,
    },
    messagesSent: { current: messagesCurrent, previous: messagesPrevious },
    bookings: { current: bookingsCurrent, previous: bookingsPrevious },
    revenueRecovered: { current: revenueCurrent, previous: revenuePrevious },
  };
}

/* ------------------------------------------------------------------ */
/* The profit-or-nothing guarantee                                     */
/* ------------------------------------------------------------------ */

export type GuaranteeSummary = {
  totalClaims: number;
  pendingClaims: number;
  refundedByCurrency: MoneyByCurrency;
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

  const refundedByCurrency: MoneyByCurrency = { ...ZERO_MONEY };

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

/* ------------------------------------------------------------------ */
/* Feedback: what gyms are telling casdey from inside the product      */
/* ------------------------------------------------------------------ */

export type FeedbackNote = {
  message: string;
  path: string | null;
  createdAt: string;
  gymName: string;
};

export type FeedbackSummary = {
  total: number;
  recentCount: number;
  latest: FeedbackNote[];
};

export async function feedbackSummary(
  gymIds: string[],
  days = DEFAULT_DAYS,
  now: Date = new Date(),
  limit = 6,
): Promise<FeedbackSummary> {
  if (gymIds.length === 0) {
    return { total: 0, recentCount: 0, latest: [] };
  }

  const supabase = supabaseAdmin();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);

  const [{ count: total }, recent, latest] = await Promise.all([
    supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds),
    supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .in("gym_id", gymIds)
      .gte("created_at", from.toISOString()),
    supabase
      .from("feedback")
      .select("message, path, created_at, gyms!inner(name)")
      .in("gym_id", gymIds)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (latest.error) {
    console.error("[admin-stats] feedback lookup failed", latest.error.message);
  }

  const notes: FeedbackNote[] = (latest.data ?? []).map((row) => {
    const gym = Array.isArray(row.gyms) ? row.gyms[0] : row.gyms;
    return {
      message: row.message as string,
      path: (row.path as string | null) ?? null,
      createdAt: row.created_at as string,
      gymName: (gym?.name as string | undefined) ?? "a gym",
    };
  });

  return {
    total: total ?? 0,
    recentCount: recent.count ?? 0,
    latest: notes,
  };
}

/* ------------------------------------------------------------------ */
/* Test & dev: everything behind gyms.is_internal, quarantined         */
/* ------------------------------------------------------------------ */

export type TestAndDev = {
  gymCount: number;
  gymNames: string[];
  members: number;
  campaignsApproved: number;
  messagesSent: number;
  bookings: number;
};

/**
 * What casdey's own dev/QA gyms have accumulated. All time, no period — this
 * is noise being kept separate, not a trend anyone tracks. It stays visible
 * because "is our own test data leaking into the real numbers" is a question
 * the founder view should answer at a glance (it did leak once: a £120 fixture
 * booking showed up as recovered revenue until migration 0036).
 */
export async function testAndDev(): Promise<TestAndDev> {
  const empty: TestAndDev = {
    gymCount: 0,
    gymNames: [],
    members: 0,
    campaignsApproved: 0,
    messagesSent: 0,
    bookings: 0,
  };

  const supabase = supabaseAdmin();
  const { data: gyms, error } = await supabase
    .from("gyms")
    .select("id, name")
    .eq("is_internal", true)
    .order("name");

  if (error) {
    console.error("[admin-stats] test/dev gyms lookup failed", error.message);
    return empty;
  }
  if (!gyms || gyms.length === 0) return empty;

  const ids = gyms.map((g) => g.id as string);
  const [members, campaigns, messages, bookings] = await Promise.all([
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .in("gym_id", ids)
      .eq("is_test", false),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .in("gym_id", ids)
      .not("approved_at", "is", null),
    supabase
      .from("campaign_messages")
      .select("id", { count: "exact", head: true })
      .in("gym_id", ids)
      .eq("status", "sent"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("gym_id", ids)
      .in("status", ["booked", "completed"]),
  ]);

  return {
    gymCount: gyms.length,
    gymNames: gyms.map((g) => g.name as string),
    members: members.count ?? 0,
    campaignsApproved: campaigns.count ?? 0,
    messagesSent: messages.count ?? 0,
    bookings: bookings.count ?? 0,
  };
}

/* --- Trials (Track H) ------------------------------------------------------ */

export type TrialRow = {
  gymId: string;
  gymName: string;
  /** Whole days left, or null once the week is over. */
  daysLeft: number | null;
  outstanding: string[];
  cancelled: boolean;
  committed: boolean;
};

export type TrialSummary = {
  /** Trials with a card on file that the day-7 job has not closed yet. */
  running: TrialRow[];
  converted: number;
  /** Card taken, then cancelled during the week. */
  cancelled: number;
};

/**
 * The paid-week funnel, for the founder view.
 *
 * Used to also list every setup fee so a human could waive them. That whole
 * mechanism was removed on 2026-09-12 (see src/lib/trial.ts), so what is left
 * is who is mid-week, who converted, and who cancelled.
 *
 * Internal gyms are excluded like everything else on this page, so Davide own
 * test weeks do not show up as customers.
 */
export async function trialSummary(gymIds: string[]): Promise<TrialSummary> {
  const empty: TrialSummary = {
    running: [],
    converted: 0,
    cancelled: 0,
  };
  if (gymIds.length === 0) return empty;

  const supabase = supabaseAdmin();

  const { data: gyms } = await supabase
      .from("gyms")
      .select(
        `id, name, country, trial_ends_at, trial_card_setup_at,
         trial_commitment_at, trial_cancelled_at, trial_converted_at,
         trial_closed_at, activated_import_at, activated_prices_at,
         activated_campaign_at`,
      )
      .in("id", gymIds)
      .not("trial_card_setup_at", "is", null);

  const rows = (gyms ?? []) as unknown as Array<
    Pick<
      Gym,
      | "id"
      | "name"
      | "country"
      | "trial_ends_at"
      | "trial_card_setup_at"
      | "trial_commitment_at"
      | "trial_cancelled_at"
      | "trial_converted_at"
      | "trial_closed_at"
      | "activated_import_at"
      | "activated_prices_at"
      | "activated_campaign_at"
    >
  >;

  const running: TrialRow[] = [];
  let converted = 0;
  let cancelled = 0;

  for (const gym of rows) {
    if (gym.trial_converted_at) converted += 1;
    if (gym.trial_cancelled_at) cancelled += 1;
    if (gym.trial_closed_at) continue;

    // The stamps only, not the live counts: this is a founder's read of who
    // has done what, not the decision that charges a card. trialOutcome() in
    // src/lib/trial.ts is the one that reads both, deliberately.
    const outstanding: string[] = [];
    if (!gym.activated_import_at) outstanding.push("import");
    if (!gym.activated_prices_at) outstanding.push("prices");
    if (!gym.activated_campaign_at) outstanding.push("campaign");

    const daysLeft = gym.trial_ends_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(gym.trial_ends_at).getTime() - Date.now()) / 86_400_000,
          ),
        )
      : null;

    running.push({
      gymId: gym.id,
      gymName: gym.name,
      daysLeft: daysLeft === 0 ? null : daysLeft,
      outstanding,
      cancelled: Boolean(gym.trial_cancelled_at),
      committed: Boolean(gym.trial_commitment_at),
    });
  }

  return { running, converted, cancelled };
}
