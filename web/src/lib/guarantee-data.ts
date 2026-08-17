import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  guaranteeStatus,
  guaranteeWindow,
  paymentsFundingWindow,
  type GuaranteeStatus,
} from "./guarantee";
import { estimatedRecoveredMinor } from "./money";
import type { GuaranteeClaim, Practice } from "./types";

/**
 * Assembles a practice's guarantee status from the database.
 *
 * The pure decision logic lives in ./guarantee.ts and is unit tested there
 * without a database. This file's only job is fetching the three numbers that
 * feed it: the first qualifying campaign, revenue recovered in the window, and
 * what was actually paid in the window. Called from both the billing page
 * (display) and the claim route (the authoritative recheck before a refund
 * fires), so there is exactly one place this can drift.
 */
export async function loadGuaranteeStatus(
  supabase: SupabaseClient,
  practice: Pick<
    Practice,
    "id" | "premium_started_at" | "appointment_value_minor"
  >,
  now: Date = new Date(),
): Promise<GuaranteeStatus> {
  const { data: existingClaim } = await supabase
    .from("guarantee_claims")
    .select("*")
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (existingClaim) {
    return guaranteeStatus({
      premiumStartedAt: practice.premium_started_at,
      firstPaidCampaignStartedAt: null,
      revenueRecoveredMinor: 0,
      paidMinor: 0,
      existingClaim: existingClaim as GuaranteeClaim,
      now,
    });
  }

  if (!practice.premium_started_at) {
    return guaranteeStatus({
      premiumStartedAt: null,
      firstPaidCampaignStartedAt: null,
      revenueRecoveredMinor: 0,
      paidMinor: 0,
      existingClaim: null,
      now,
    });
  }

  // The first campaign started on or after the first real payment. Anything
  // sent during the free week does not count; see ./guarantee.ts.
  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("started_at")
    .eq("practice_id", practice.id)
    .not("started_at", "is", null)
    .gte("started_at", practice.premium_started_at)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const firstPaidCampaignStartedAt = campaignRow?.started_at ?? null;

  if (!firstPaidCampaignStartedAt) {
    return guaranteeStatus({
      premiumStartedAt: practice.premium_started_at,
      firstPaidCampaignStartedAt: null,
      revenueRecoveredMinor: 0,
      paidMinor: 0,
      existingClaim: null,
      now,
    });
  }

  // guaranteeWindow() cannot actually return null here: both inputs are
  // non-null at this point. The check keeps TypeScript honest without a
  // non-null assertion.
  const window = guaranteeWindow(
    practice.premium_started_at,
    firstPaidCampaignStartedAt,
  );
  if (!window) {
    return guaranteeStatus({
      premiumStartedAt: practice.premium_started_at,
      firstPaidCampaignStartedAt: null,
      revenueRecoveredMinor: 0,
      paidMinor: 0,
      existingClaim: null,
      now,
    });
  }

  // Progress so far for a still-running window, the final figure for a closed
  // one: never count anything past "now", and never past the window either.
  const countedThrough = now < window.end ? now : window.end;

  const [{ count: rebooked }, { data: paidRows }] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practice.id)
      .eq("status", "reactivated")
      // The self-test synthetic patient (src/lib/self-test.ts) can now book
      // itself through the same self-serve flow a real patient uses, and it
      // must never count toward the guarantee any more than it counts toward
      // the dashboard's own "rebooked" stat (src/lib/stats.ts).
      .eq("is_test", false)
      .gte("reactivated_at", window.start.toISOString())
      .lte("reactivated_at", countedThrough.toISOString()),
    // Read from premium_started_at so the payment that unlocked Premium (which
    // lands before the first campaign is approved) is in scope, then narrow to
    // the window's own billing period with paymentsFundingWindow() below. The
    // old code summed this whole span, which over-counted — and over-refunded —
    // any extra month a practice ran up before launching its first campaign.
    supabase
      .from("subscription_payments")
      .select("amount_minor, paid_at")
      .eq("practice_id", practice.id)
      .gte("paid_at", practice.premium_started_at)
      .lte("paid_at", countedThrough.toISOString()),
  ]);

  const paidMinor = paymentsFundingWindow(
    (paidRows ?? []) as { amount_minor: number; paid_at: string }[],
    window.start,
  ).reduce((sum, row) => sum + row.amount_minor, 0);

  // Same formula the dashboard uses (see ./money.ts), so the number on the
  // billing page and the number a claim is judged against can never drift
  // apart. When the practice has never set a value there is no honest revenue
  // figure: it still reads as zero here, but revenueEstimable=false below means
  // a shortfall routes to review rather than an automatic self-serve refund, so
  // an unset value can no longer be used to claw back a full window for free.
  const revenueEstimable =
    practice.appointment_value_minor != null &&
    practice.appointment_value_minor > 0;
  const revenueRecoveredMinor =
    estimatedRecoveredMinor(rebooked ?? 0, practice.appointment_value_minor) ??
    0;

  return guaranteeStatus({
    premiumStartedAt: practice.premium_started_at,
    firstPaidCampaignStartedAt,
    revenueRecoveredMinor,
    paidMinor,
    revenueEstimable,
    existingClaim: null,
    now,
  });
}
