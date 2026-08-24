import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  guaranteeStatus,
  guaranteeWindow,
  paymentsFundingWindow,
  type GuaranteeStatus,
  type GuaranteeWindow,
} from "./guarantee";
import { estimatedRecoveredMinor } from "./money";
import type { GuaranteeClaim, Gym } from "./types";

/**
 * Assembles a gym's guarantee status from the database.
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
  gym: Pick<
    Gym,
    "id" | "premium_started_at" | "booking_value_minor"
  >,
  now: Date = new Date(),
): Promise<GuaranteeStatus> {
  const { data: existingClaim } = await supabase
    .from("guarantee_claims")
    .select("*")
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (existingClaim) {
    return guaranteeStatus({
      premiumStartedAt: gym.premium_started_at,
      firstPaidCampaignStartedAt: null,
      revenueRecoveredMinor: 0,
      paidMinor: 0,
      existingClaim: existingClaim as GuaranteeClaim,
      now,
    });
  }

  if (!gym.premium_started_at) {
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
    .eq("gym_id", gym.id)
    .not("started_at", "is", null)
    .gte("started_at", gym.premium_started_at)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const firstPaidCampaignStartedAt = campaignRow?.started_at ?? null;

  if (!firstPaidCampaignStartedAt) {
    return guaranteeStatus({
      premiumStartedAt: gym.premium_started_at,
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
    gym.premium_started_at,
    firstPaidCampaignStartedAt,
  );
  if (!window) {
    return guaranteeStatus({
      premiumStartedAt: gym.premium_started_at,
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

  const [{ count: returned }, { data: paidRows }] = await Promise.all([
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id)
      .eq("status", "returned")
      // The self-test synthetic member (src/lib/self-test.ts) can now book
      // itself through the same self-serve flow a real member uses, and it
      // must never count toward the guarantee any more than it counts toward
      // the dashboard's own "returned" stat (src/lib/stats.ts).
      .eq("is_test", false)
      .gte("returned_at", window.start.toISOString())
      .lte("returned_at", countedThrough.toISOString()),
    // Read from premium_started_at so the payment that unlocked Premium (which
    // lands before the first campaign is approved) is in scope, then narrow to
    // the window's own billing period with paymentsFundingWindow() below. The
    // old code summed this whole span, which over-counted — and over-refunded —
    // any extra month a gym ran up before launching its first campaign.
    supabase
      .from("subscription_payments")
      .select("amount_minor, paid_at")
      .eq("gym_id", gym.id)
      .gte("paid_at", gym.premium_started_at)
      .lte("paid_at", countedThrough.toISOString()),
  ]);

  const paidMinor = paymentsFundingWindow(
    (paidRows ?? []) as { amount_minor: number; paid_at: string }[],
    window.start,
  ).reduce((sum, row) => sum + row.amount_minor, 0);

  // Same formula the dashboard uses (see ./money.ts), so the number on the
  // billing page and the number a claim is judged against can never drift
  // apart. When the gym has never set a value there is no honest revenue
  // figure: it still reads as zero here, but revenueEstimable=false below means
  // a shortfall routes to review rather than an automatic self-serve refund, so
  // an unset value can no longer be used to claw back a full window for free.
  const revenueEstimable =
    gym.booking_value_minor != null &&
    gym.booking_value_minor > 0;
  const revenueRecoveredMinor =
    estimatedRecoveredMinor(returned ?? 0, gym.booking_value_minor) ??
    0;

  return guaranteeStatus({
    premiumStartedAt: gym.premium_started_at,
    firstPaidCampaignStartedAt,
    revenueRecoveredMinor,
    paidMinor,
    revenueEstimable,
    existingClaim: null,
    now,
  });
}

export type GuaranteeLedgerRow = {
  memberId: string;
  memberName: string;
  returnedAt: string;
  valueMinor: number;
  runningTotalMinor: number;
};

/**
 * The line-by-line breakdown behind a single "revenue recovered" figure.
 *
 * Deliberately reuses the exact same query loadGuaranteeStatus counts from
 * (same gym_id/status/is_test/window filters) and the exact same per-member
 * value (the gym's flat typical booking value, never a real booking's own
 * price) that ./money.ts's estimatedRecoveredMinor multiplies by. That is
 * what makes summing this list's rows structurally unable to disagree with
 * the headline number: there is no second formula here to drift out of sync
 * with the first one. A richer version that valued each member by their
 * actual booking (when one exists) would be a real change to what "revenue
 * recovered" means, not just a display, and needs its own decision before
 * being built, see the wiki competitive-research backlog.
 */
export async function loadGuaranteeLedger(
  supabase: SupabaseClient,
  gym: Pick<Gym, "id" | "booking_value_minor">,
  window: GuaranteeWindow,
  countedThrough: Date,
): Promise<GuaranteeLedgerRow[]> {
  const value = gym.booking_value_minor;
  if (!value || value <= 0) return [];

  const { data } = await supabase
    .from("members")
    .select("id, first_name, last_name, returned_at")
    .eq("gym_id", gym.id)
    .eq("status", "returned")
    .eq("is_test", false)
    .gte("returned_at", window.start.toISOString())
    .lte("returned_at", countedThrough.toISOString())
    .order("returned_at", { ascending: true });

  let running = 0;
  return (data ?? []).map((row) => {
    running += value;
    return {
      memberId: row.id as string,
      memberName:
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        "Member",
      returnedAt: row.returned_at as string,
      valueMinor: value,
      runningTotalMinor: running,
    };
  });
}

/**
 * Convenience wrapper for the billing page: pulls the window straight off
 * whichever GuaranteeStatus it was handed, so the page does not need its own
 * copy of "which states have a window" or the running/closed countedThrough
 * rule loadGuaranteeStatus already applies. Empty for `not_started` and
 * `claimed`, states with no window to itemize (a claimed gym's window is
 * still real, but re-deriving it here would be a second, easy-to-drift copy
 * of the window logic for a state that no longer needs live figures anyway).
 */
export async function loadGuaranteeLedgerForStatus(
  supabase: SupabaseClient,
  gym: Pick<Gym, "id" | "booking_value_minor">,
  status: GuaranteeStatus,
  now: Date = new Date(),
): Promise<GuaranteeLedgerRow[]> {
  if (status.state === "not_started" || status.state === "claimed") return [];
  const countedThrough = now < status.window.end ? now : status.window.end;
  return loadGuaranteeLedger(supabase, gym, status.window, countedThrough);
}
