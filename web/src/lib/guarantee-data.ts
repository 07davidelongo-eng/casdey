import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  guaranteeStatus,
  guaranteeWindow,
  paymentsFundingWindow,
  qualifyingCampaignsFrom,
  type GuaranteeStatus,
  type GuaranteeWindow,
} from "./guarantee";
import { hasPricedServices, recoveredRevenue } from "./revenue";
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
    "id" | "premium_started_at" | "trial_card_setup_at"
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

  // The first campaign started on or after the first real payment, or during
  // the paid first week that converted into it. Anything earlier does not
  // count; see qualifyingCampaignsFrom() in ./guarantee.ts.
  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("started_at")
    .eq("gym_id", gym.id)
    .not("started_at", "is", null)
    .gte(
      "started_at",
      qualifyingCampaignsFrom(
        gym.premium_started_at,
        gym.trial_card_setup_at,
      ).toISOString(),
    )
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

  const [recovered, priced, { data: paidRows }] = await Promise.all([
    // What was really booked in the window, each booking at the price of the
    // service it was for. See src/lib/revenue.ts for why this replaced a flat
    // per-member figure the gym typed in.
    recoveredRevenue(supabase, gym.id, {
      from: window.start,
      to: countedThrough,
    }),
    hasPricedServices(supabase, gym.id),
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

  // Same function the dashboard uses, so the number on the billing page and
  // the number a claim is judged against cannot drift apart. A gym that has
  // never priced a service reads as zero here for reasons that have nothing
  // to do with whether casdey worked, so revenueEstimable=false routes a
  // shortfall to review rather than to an automatic self-serve refund.
  const revenueEstimable = priced;
  const revenueRecoveredMinor = recovered.totalMinor;

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
  bookingId: string;
  memberName: string;
  serviceName: string;
  bookedAt: string;
  valueMinor: number;
  runningTotalMinor: number;
};

/**
 * The line-by-line breakdown behind a single "revenue recovered" figure.
 *
 * One row per booking, not per member, because that is now what the headline
 * number is made of: Marco on a 50 euro membership and Sara on a 20 euro yoga
 * class are two different lines, and adding them up has to land exactly on
 * the figure the claim is judged against.
 *
 * Same filters and the same per-booking value recoveredRevenue() uses, so
 * summing this list cannot disagree with the total. A booking with no service
 * on it is left out of both, and the gym is told separately how many of those
 * there are rather than being shown an unexplained gap.
 */
export async function loadGuaranteeLedger(
  supabase: SupabaseClient,
  gym: Pick<Gym, "id">,
  window: GuaranteeWindow,
  countedThrough: Date,
): Promise<GuaranteeLedgerRow[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, created_at, value_minor, members!inner(first_name, last_name, is_test), services(name)",
    )
    .eq("gym_id", gym.id)
    .in("status", ["booked", "completed"])
    // The self-test synthetic member (src/lib/self-test.ts) books through the
    // same self-serve flow a real member uses, and must never count toward
    // the guarantee.
    .eq("members.is_test", false)
    .gte("created_at", window.start.toISOString())
    .lte("created_at", countedThrough.toISOString())
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    created_at: string;
    value_minor: number | null;
    members: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
    services: { name: string } | { name: string }[] | null;
  };

  const one = <T,>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : value;

  let running = 0;
  const rows: GuaranteeLedgerRow[] = [];

  for (const row of (data ?? []) as unknown as Row[]) {
    const service = one(row.services);
    const value = row.value_minor ?? 0;
    if (!service || value <= 0) continue;

    const member = one(row.members);
    running += value;
    rows.push({
      bookingId: row.id,
      memberName:
        [member?.first_name, member?.last_name].filter(Boolean).join(" ").trim() ||
        "Member",
      serviceName: service.name,
      bookedAt: row.created_at,
      valueMinor: value,
      runningTotalMinor: running,
    });
  }

  return rows;
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
  gym: Pick<Gym, "id">,
  status: GuaranteeStatus,
  now: Date = new Date(),
): Promise<GuaranteeLedgerRow[]> {
  if (status.state === "not_started" || status.state === "claimed") return [];
  const countedThrough = now < status.window.end ? now : status.window.end;
  return loadGuaranteeLedger(supabase, gym, status.window, countedThrough);
}
