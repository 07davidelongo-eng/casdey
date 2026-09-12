import "server-only";

import { supabaseAdmin } from "./supabase";
import { paidTrialEnabled } from "./plan";
import { sendTrialNudge } from "./email/trial-nudge";
import {
  ACTIVATION_LABELS,
  activationFor,
  nudgeDue,
  trialOutcome,
  unfinishedSteps,
  type ActivationEvidence,
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
 * Two things happen, and each is independent so one failing cannot stop the
 * other:
 *
 *   1. Nudges, to weeks still running.
 *   2. Closing out weeks that have ended, either handing them to Stripe or
 *      releasing them.
 *
 * **Nothing in this file charges anything any more**, which is the point of
 * it. It used to bill a setup fee per unfinished activation step (dropped
 * 2026-09-12) and then, after that, create and charge the day 7 subscription
 * (dropped the same day). The subscription is now created at signup with a
 * Stripe trial on it, so Stripe bills day 7 itself against a mandate taken
 * on-session. See the note at the top of ./trial.ts for why that matters.
 *
 * The whole job is gated on paidTrialEnabled(). With the flag off it does
 * nothing at all.
 */

export type TrialJobReport = {
  nudged: number;
  /** Weeks that ended with a live Stripe subscription behind them. Stripe
   *  bills these; this job only closed the local record. Deliberately not
   *  called "converted", because nothing here collected any money and the
   *  payment may still be in flight. */
  handedOver: number;
  released: number;
  failures: string[];
};

const EMPTY: TrialJobReport = {
  nudged: 0,
  handedOver: 0,
  released: 0,
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

  // Stripe owns the charge. All that is left is to close casdey's own record
  // of the week so this job stops looking at the gym; entitlement arrives on
  // the webhook, from invoice.paid and customer.subscription.updated.
  //
  // trial_converted_at is deliberately NOT stamped here. At this moment the
  // day 7 invoice may be paid, may be waiting on the gym's bank, or may have
  // been refused, and this job cannot tell which. Recording a conversion on
  // the strength of a subscription merely existing is the exact fault that had
  // to be fixed in convert() earlier the same day. The webhook stamps it when
  // the subscription actually goes active, which is when money has moved.
  await closeTrial(gym.id, {});
  report.handedOver += 1;
  console.log(`[trial] handed to Stripe ${gym.id}`);
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
