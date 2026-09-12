import "server-only";

import { supabaseAdmin } from "./supabase";
import { captureServerEvent } from "./posthog-server";
import { currencyFor } from "./countries";
import { earlyAdopterProgramActive, paidTrialEnabled } from "./plan";
import { couponIdFor, findPricePlan, priceIdFor, stripeClient } from "./stripe";
import { sendTrialNudge } from "./email/trial-nudge";
import { sendTrialAuthNeeded } from "./email/trial-auth";
import {
  ACTIVATION_LABELS,
  activationFor,
  conversionResultFor,
  nudgeDue,
  trialOutcome,
  unfinishedSteps,
  type ActivationEvidence,
  type ConversionResult,
} from "./trial";
import type { Gym } from "./types";

/**
 * The day 7 job for the paid first week.
 *
 * Runs off the existing daily cron rather than its own schedule, because
 * Vercel's Hobby plan caps cron jobs and casdey is on Hobby (confirmed
 * 2026-09-03). One consequence to be honest about: "day 7" resolves within a
 * day, not to the hour. That is acceptable and is recorded in the plan.
 *
 * Three things happen, and each is independent so one failing cannot stop the
 * others:
 *
 *   1. Nudges, to weeks still running.
 *   2. Conversions, for weeks that reach day 7 with a card and no cancellation.
 *   3. Releases, for everything else. Nothing is ever charged here.
 *
 * **The setup fee is gone** (2026-09-12). This job used to have a fourth job,
 * billing 20 euro per activation step left unfinished, and a fifth, refunding
 * those fees when a gym went and did the thing. Both are deleted along with the
 * mechanism; see the note at the top of ./trial.ts for why. Nothing in this
 * file now charges a card except the subscription a gym agreed to.
 *
 * The whole job is gated on paidTrialEnabled(). With the flag off it does
 * nothing at all.
 */

export type TrialJobReport = {
  nudged: number;
  converted: number;
  released: number;
  /** Conversions Stripe accepted but has not collected, because the bank wants
   *  the owner to approve the charge. Counted apart from `converted` precisely
   *  so a stalled payment cannot be read as a sale. */
  pendingAuth: number;
  /** Conversions the card refused outright. Nothing to authenticate. */
  conversionFailed: number;
  failures: string[];
};

const EMPTY: TrialJobReport = {
  nudged: 0,
  converted: 0,
  released: 0,
  pendingAuth: 0,
  conversionFailed: 0,
  failures: [],
};

/** Every column the logic reads. */
const TRIAL_COLUMNS = `
  id, name, country, contact_email, early_adopter,
  stripe_customer_id, stripe_subscription_id, subscription_status,
  trial_ends_at, trial_card_setup_at, trial_payment_method_id,
  trial_commitment_at, trial_cancelled_at, trial_converted_at,
  trial_closed_at, trial_last_nudge_day,
  activated_import_at, activated_prices_at, activated_campaign_at
`;

type TrialGymRow = Pick<
  Gym,
  | "id"
  | "name"
  | "country"
  | "contact_email"
  | "early_adopter"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "subscription_status"
  | "trial_ends_at"
  | "trial_card_setup_at"
  | "trial_payment_method_id"
  | "trial_commitment_at"
  | "trial_cancelled_at"
  | "trial_converted_at"
  | "trial_closed_at"
  | "trial_last_nudge_day"
  | "activated_import_at"
  | "activated_prices_at"
  | "activated_campaign_at"
>;

/**
 * Whether each activation step's work actually exists, counted rather than
 * inferred. Read alongside the stamps, never instead of them: see the note on
 * activationFor() in ./trial.ts.
 *
 * Only called for weeks still running, because activation no longer affects
 * what happens at day 7. It decides what a nudge says, and nothing else.
 */
async function evidenceFor(gymId: string): Promise<ActivationEvidence> {
  const db = supabaseAdmin();
  const [members, priced, campaigns] = await Promise.all([
    db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("is_test", false),
    db
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("active", true)
      .gt("price_minor", 0),
    db
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .not("approved_at", "is", null),
  ]);

  return {
    hasMembers: (members.count ?? 0) > 0,
    hasPricedServices: (priced.count ?? 0) > 0,
    hasApprovedCampaign: (campaigns.count ?? 0) > 0,
  };
}

export async function runTrialJob(
  now: Date = new Date(),
): Promise<TrialJobReport> {
  if (!paidTrialEnabled()) return EMPTY;

  const report: TrialJobReport = { ...EMPTY, failures: [] };

  // Every gym with a week that has not been closed out yet. Internal gyms are
  // deliberately included: a dev account should exercise the same path, and it
  // is the only way this gets tested before a real gym meets it.
  const { data, error } = await supabaseAdmin()
    .from("gyms")
    .select(TRIAL_COLUMNS)
    .not("trial_ends_at", "is", null)
    .is("trial_closed_at", null);

  if (error) {
    report.failures.push(`gym query failed: ${error.message}`);
    return report;
  }

  const gyms = (data ?? []) as unknown as TrialGymRow[];

  for (const gym of gyms) {
    try {
      await processGym(gym, report, now);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      report.failures.push(`${gym.id}: ${detail}`);
      console.error("[trial] gym failed", gym.id, detail);
    }
  }

  return report;
}

async function processGym(
  gym: TrialGymRow,
  report: TrialJobReport,
  now: Date,
): Promise<void> {
  const outcome = trialOutcome(gym, now);

  if (outcome.kind === "wait") {
    // Still inside the week. The only thing to do is nudge, and only that
    // branch needs to know how far the setup got.
    const evidence = await evidenceFor(gym.id);
    const states = activationFor(gym, evidence);
    const outstanding = unfinishedSteps(states);
    const day = nudgeDue(gym, outstanding, now);
    if (day != null) {
      await sendTrialNudge({
        gym,
        day,
        outstanding: outstanding.map((s) => ACTIVATION_LABELS[s]),
      });
      await supabaseAdmin()
        .from("gyms")
        .update({ trial_last_nudge_day: day })
        .eq("id", gym.id);
      report.nudged += 1;
    }
    return;
  }

  if (outcome.kind === "release") {
    await closeTrial(gym.id, {});
    report.released += 1;
    console.log(`[trial] released ${gym.id}: ${outcome.reason}`);
    return;
  }

  const result = await convert(gym);
  if (result === "converted") report.converted += 1;
  else if (result === "needs_authentication") report.pendingAuth += 1;
  else report.conversionFailed += 1;
}

async function closeTrial(
  gymId: string,
  extra: Record<string, string>,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({ trial_closed_at: new Date().toISOString(), ...extra })
    // Only if still open, so two overlapping runs cannot both act.
    .is("trial_closed_at", null)
    .eq("id", gymId);

  if (error) throw new Error(`could not close the week: ${error.message}`);
}

/**
 * Turns a finished paid week into a Pro subscription.
 *
 * Pro and monthly, deliberately: the week was a week of Pro, so converting to
 * anything less would take features away at the moment the gym starts paying,
 * and nobody agreed to an annual commitment up front.
 *
 * The subscription is created directly rather than through Checkout, because
 * there is no browser here. The existing webhook picks up
 * customer.subscription.created and writes subscription_status and plan_tier,
 * so this does not duplicate any of that.
 */
async function convert(gym: TrialGymRow): Promise<ConversionResult> {
  if (!gym.stripe_customer_id || !gym.trial_payment_method_id) {
    // trialOutcome already guarantees a card, so this is belt and braces.
    await closeTrial(gym.id, {});
    throw new Error("convert reached without a customer or payment method");
  }

  const currency = currencyFor(gym.country);
  const plan = findPricePlan("pro", currency, "month");
  if (!plan) throw new Error(`no Pro month price for ${currency}`);

  const coupon =
    gym.early_adopter && earlyAdopterProgramActive()
      ? couponIdFor(currency)
      : undefined;

  const subscription = await stripeClient().subscriptions.create({
    customer: gym.stripe_customer_id,
    items: [{ price: priceIdFor(plan), quantity: 1 }],
    default_payment_method: gym.trial_payment_method_id,
    // Same metadata the Checkout path stamps, for the same reason: the webhook
    // resolves the tier from the price id first and falls back to this when a
    // STRIPE_PRICE_* var is missing or mistyped. Without it a half-configured
    // environment resolves nothing, and effectivePlan() reads a null tier on an
    // active subscription as Pro.
    metadata: { gym_id: gym.id, plan_tier: "pro", source: "trial_conversion" },
    ...(coupon ? { discounts: [{ coupon }] } : {}),
    // Expanded so the hosted invoice page is in hand without a second round
    // trip. It is the link a gym needs when its bank asks for 3-D Secure, and
    // it is only reachable from the invoice.
    expand: ["latest_invoice"],
  });

  const result = conversionResultFor(subscription.status);

  // The week closes either way: it genuinely ended, and leaving it open would
  // have tomorrow's run create a SECOND subscription for the same gym.
  // trial_converted_at is stamped only on a real conversion, so casdey's own
  // records can never claim a payment that did not happen.
  await closeTrial(
    gym.id,
    result === "converted"
      ? { trial_converted_at: new Date().toISOString() }
      : {},
  );

  if (result === "converted") {
    await captureServerEvent(gym.id, "trial_converted", {
      tier: "pro",
      currency,
      discounted: Boolean(coupon),
      subscription_id: subscription.id,
    });
    return result;
  }

  if (result === "needs_authentication") {
    const invoice = subscription.latest_invoice;
    const authUrl =
      invoice && typeof invoice !== "string"
        ? (invoice.hosted_invoice_url ?? null)
        : null;
    // A failed send must not lose the outcome: the subscription exists and the
    // gym still needs telling, so this is logged loudly rather than thrown.
    try {
      await sendTrialAuthNeeded({ gym, authUrl });
    } catch (err) {
      console.error(
        `[trial] could not send auth email ${gym.id}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  await captureServerEvent(gym.id, "trial_conversion_stalled", {
    tier: "pro",
    currency,
    result,
    stripe_status: subscription.status,
    subscription_id: subscription.id,
  });

  console.warn(
    `[trial] conversion incomplete ${gym.id}: ${subscription.status} (${result})`,
  );

  return result;
}
