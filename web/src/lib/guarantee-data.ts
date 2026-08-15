import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { guaranteeStatus, guaranteeWindow, type GuaranteeStatus } from "./guarantee";
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
    // Deliberately practice.premium_started_at here, not window.start (the
    // first qualifying campaign's start): the payment that actually unlocked
    // Premium always happens before the practice gets around to approving a
    // campaign, so window.start would exclude the very payment the guarantee
    // exists to cover, and paidMinor would read 0 for almost every real
    // practice — which "met" below reads as "nothing to refund" regardless of
    // outcome. Safe to widen like this only because premium_started_at is set
    // once and never touched again (see ../app/api/stripe/webhook/route.ts),
    // so this can never pull in a second, unrelated billing period.
    supabase
      .from("subscription_payments")
      .select("amount_minor")
      .eq("practice_id", practice.id)
      .gte("paid_at", practice.premium_started_at)
      .lte("paid_at", countedThrough.toISOString()),
  ]);

  const paidMinor = (paidRows ?? []).reduce(
    (sum, row) => sum + (row.amount_minor as number),
    0,
  );

  // Same formula the dashboard uses (see ./money.ts), so the number on the
  // billing page and the number a claim is judged against can never drift
  // apart. If the practice has never set a value, there is no honest revenue
  // figure to credit them with, so it counts as zero rather than blocking the
  // guarantee outright — the guarantee should not be defeated by a setting
  // nobody was told they had to fill in.
  const revenueRecoveredMinor =
    estimatedRecoveredMinor(rebooked ?? 0, practice.appointment_value_minor) ??
    0;

  return guaranteeStatus({
    premiumStartedAt: practice.premium_started_at,
    firstPaidCampaignStartedAt,
    revenueRecoveredMinor,
    paidMinor,
    existingClaim: null,
    now,
  });
}
