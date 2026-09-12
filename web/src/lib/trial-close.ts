import "server-only";

import { supabaseAdmin } from "./supabase";
import { captureServerEvent } from "./posthog-server";
import { currencyFor } from "./countries";
import { earlyAdopterProgramActive, trialPenaltyEnabled } from "./plan";
import {
  couponIdFor,
  findPricePlan,
  priceIdFor,
  stripeClient,
} from "./stripe";
import { sendTrialNudge } from "./email/trial-nudge";
import {
  ACTIVATION_LABELS,
  SETUP_FEE_MINOR,
  activationFor,
  feeForUnfinished,
  madeGood,
  nudgeDue,
  trialOutcome,
  unfinishedSteps,
  type ActivationEvidence,
  type ActivationStep,
} from "./trial";
import type { Gym, TrialPenalty } from "./types";

/**
 * The day-7 job for Trial With Penalty (Track H).
 *
 * Runs off the existing daily cron rather than its own schedule, because
 * Vercel's Hobby plan caps cron jobs and casdey is on Hobby (confirmed
 * 2026-09-03). One consequence to be honest about: "day 7" resolves within a
 * day, not to the hour. That is acceptable for a free week and is recorded in
 * the plan.
 *
 * Four things happen here, in this order, and each is independent so one
 * failing cannot stop the others:
 *
 *   1. Nudges, to trials still running with steps outstanding.
 *   2. Make-good refunds, for fees whose step has since been finished.
 *   3. Conversions, for trials that did all three.
 *   4. Setup fees, for trials that ghosted.
 *
 * The whole job is gated on trialPenaltyEnabled(). With the flag off it does
 * nothing at all, so applying 0038 and deploying this changes no behaviour
 * until Davide turns it on.
 */

export type TrialJobReport = {
  nudged: number;
  madeGood: number;
  converted: number;
  charged: number;
  released: number;
  failures: string[];
};

const EMPTY: TrialJobReport = {
  nudged: 0,
  madeGood: 0,
  converted: 0,
  charged: 0,
  released: 0,
  failures: [],
};

/** Every column the trial logic reads. */
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
 * activationFor() in ./trial.ts for why a missed stamp must not cost a gym
 * money.
 *
 * Per-gym probes rather than one aggregate query, which is fine at casdey's
 * scale (single digits of gyms on trial at a time) and is the same call
 * admin-stats.ts makes for its activation funnel.
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
  if (!trialPenaltyEnabled()) return EMPTY;

  const report: TrialJobReport = { ...EMPTY, failures: [] };

  // Every gym with a trial that has not been closed out yet. Internal gyms
  // are deliberately included: a dev account should exercise the same path,
  // and it is the only way this gets tested before a real gym meets it.
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

  // Refunds are swept separately: they concern gyms whose trial is already
  // closed, which the query above excludes by design.
  try {
    report.madeGood = await sweepMakeGood(now);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    report.failures.push(`make-good sweep failed: ${detail}`);
  }

  return report;
}

async function processGym(
  gym: TrialGymRow,
  report: TrialJobReport,
  now: Date,
): Promise<void> {
  const evidence = await evidenceFor(gym.id);
  const outcome = trialOutcome(gym, evidence, now);

  if (outcome.kind === "wait") {
    // Still inside the week. The only thing to do is nudge.
    const states = activationFor(gym, evidence);
    const day = nudgeDue(gym, unfinishedSteps(states), now);
    if (day != null) {
      await sendTrialNudge({
        gym,
        day,
        outstanding: unfinishedSteps(states).map((s) => ACTIVATION_LABELS[s]),
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

  if (outcome.kind === "convert") {
    await convert(gym);
    report.converted += 1;
    return;
  }

  await chargeSetupFees(gym, outcome.steps);
  report.charged += 1;
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

  if (error) throw new Error(`could not close trial: ${error.message}`);
}

/**
 * Turns a finished trial into a paid Pro subscription.
 *
 * Pro and monthly, deliberately: the trial granted the full Pro feature set,
 * so converting to anything less would take features away at the moment the
 * gym starts paying, and nobody agreed to an annual commitment up front.
 *
 * The subscription is created directly rather than through Checkout, because
 * there is no browser here. The existing webhook picks up
 * customer.subscription.created and writes subscription_status and plan_tier,
 * so this does not duplicate any of that.
 */
async function convert(gym: TrialGymRow): Promise<void> {
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
    // Same metadata the Checkout path stamps, for the same reason: the
    // webhook resolves the tier from the price id first and falls back to
    // this when a STRIPE_PRICE_* var is missing or mistyped. Without it a
    // half-configured environment resolves nothing, and effectivePlan() reads
    // a null tier on an active subscription as Pro.
    metadata: { gym_id: gym.id, plan_tier: "pro", source: "trial_conversion" },
    ...(coupon ? { discounts: [{ coupon }] } : {}),
  });

  await closeTrial(gym.id, { trial_converted_at: new Date().toISOString() });

  await captureServerEvent(gym.id, "trial_converted", {
    tier: "pro",
    currency,
    discounted: Boolean(coupon),
    subscription_id: subscription.id,
  });
}

/**
 * Bills the setup fee for each step the gym never finished.
 *
 * One PaymentIntent per step rather than one for the total, following MM
 * pg 124 ("I'd rather bill $50 for each mess up than one $500 fee"), and
 * because a per-step charge is what makes the make-good refund possible: a
 * gym that later finishes one of three steps gets that one fee back, which a
 * single lumped charge could not express.
 *
 * A decline is recorded and then left alone. Chasing a failed nudge-fee would
 * cost more goodwill than the €20 is worth, and the fee was never revenue.
 */
async function chargeSetupFees(
  gym: TrialGymRow,
  steps: ActivationStep[],
): Promise<void> {
  const currency = currencyFor(gym.country);
  const amount = SETUP_FEE_MINOR[currency];
  const stripe = stripeClient();
  const db = supabaseAdmin();

  for (const step of steps) {
    // Claim the row first. The unique (gym_id, step) constraint means a
    // concurrent run loses here rather than charging the card twice.
    const { data: claimed, error: claimError } = await db
      .from("trial_penalties")
      .insert({
        gym_id: gym.id,
        step,
        amount_minor: amount,
        currency,
      })
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      // Already billed, or the insert failed. Either way do not charge.
      if (claimError) {
        console.error(
          `[trial] could not claim fee ${gym.id}/${step}`,
          claimError.message,
        );
      }
      continue;
    }

    try {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: gym.stripe_customer_id ?? undefined,
        payment_method: gym.trial_payment_method_id ?? undefined,
        off_session: true,
        confirm: true,
        // What the gym will see on its statement and in the email. "Setup
        // fee" is the customer-facing word; never "penalty".
        description: `casdey setup fee: ${ACTIVATION_LABELS[step].toLowerCase()}`,
        metadata: { gym_id: gym.id, step, kind: "trial_setup_fee" },
      });

      await db
        .from("trial_penalties")
        .update({
          stripe_payment_intent_id: intent.id,
          charged_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);

      await captureServerEvent(gym.id, "trial_penalty_charged", {
        step,
        amount_minor: amount,
        currency,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      await db
        .from("trial_penalties")
        .update({ failure_reason: detail.slice(0, 500) })
        .eq("id", claimed.id);
      console.error(`[trial] fee charge failed ${gym.id}/${step}`, detail);
    }
  }

  await closeTrial(gym.id, {});

  console.log(
    `[trial] charged ${gym.id}: ${steps.join(", ")} = ${feeForUnfinished(
      steps,
      currency,
    )} ${currency}`,
  );
}

/**
 * Refunds a fee whose step the gym has since finished. MM pg 128, "make up
 * for goofs".
 *
 * This is the half that keeps the mechanism honest. The fee is there to get
 * the gym set up, so a gym that goes and does it afterwards should not still
 * be out of pocket, and it should not have to ask.
 */
async function sweepMakeGood(now: Date): Promise<number> {
  const db = supabaseAdmin();

  const { data: open, error } = await db
    .from("trial_penalties")
    .select("id, gym_id, step, charged_at, stripe_payment_intent_id")
    .not("charged_at", "is", null)
    .is("refunded_at", null);

  if (error) throw new Error(error.message);
  if (!open || open.length === 0) return 0;

  const stripe = stripeClient();
  let refunded = 0;

  for (const fee of open as Array<
    Pick<
      TrialPenalty,
      "id" | "gym_id" | "step" | "charged_at" | "stripe_payment_intent_id"
    >
  >) {
    if (!fee.charged_at || !fee.stripe_payment_intent_id) continue;

    const { data: gym } = await db
      .from("gyms")
      .select(
        "activated_import_at, activated_prices_at, activated_campaign_at",
      )
      .eq("id", fee.gym_id)
      .maybeSingle();
    if (!gym) continue;

    const column =
      fee.step === "import"
        ? "activated_import_at"
        : fee.step === "prices"
          ? "activated_prices_at"
          : "activated_campaign_at";
    const doneAt = (gym as Record<string, string | null>)[column];

    if (!madeGood(fee.charged_at, doneAt, now)) continue;

    try {
      await stripe.refunds.create({
        payment_intent: fee.stripe_payment_intent_id,
      });
      await db
        .from("trial_penalties")
        .update({
          refunded_at: new Date().toISOString(),
          refund_reason: "made_good",
        })
        .eq("id", fee.id)
        .is("refunded_at", null);
      refunded += 1;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[trial] make-good refund failed ${fee.id}`, detail);
    }
  }

  return refunded;
}

/**
 * Waives a fee: refunds it and records that a human decided to.
 *
 * Called from /admin. MM pg 128 is explicit that this should exist and be
 * used: "I don't like billing non-starters. A small fee isn't worth a 1-star
 * review."
 */
export async function waiveTrialPenalty(feeId: string): Promise<void> {
  const db = supabaseAdmin();

  const { data: fee, error } = await db
    .from("trial_penalties")
    .select("id, stripe_payment_intent_id, charged_at, refunded_at")
    .eq("id", feeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!fee) throw new Error("No such fee.");
  if (fee.refunded_at) return; // Already given back.

  // A fee that never actually charged (a decline) still gets marked waived, so
  // it stops showing as owed. There is simply nothing to refund.
  if (fee.charged_at && fee.stripe_payment_intent_id) {
    await stripeClient().refunds.create({
      payment_intent: fee.stripe_payment_intent_id as string,
    });
  }

  await db
    .from("trial_penalties")
    .update({
      refunded_at: new Date().toISOString(),
      refund_reason: "waived",
    })
    .eq("id", feeId)
    .is("refunded_at", null);
}

