import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin, UNIQUE_VIOLATION } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { loadGuaranteeStatus } from "@/lib/guarantee-data";
import { paymentsFundingWindow } from "@/lib/guarantee";
import { capabilities } from "@/lib/plan";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The profit-or-nothing guarantee, self-service: one click, and if the
 * gym genuinely qualifies, the refund fires immediately with nobody at
 * casdey reviewing it first. That is only safe because of what
 * src/lib/guarantee.ts guarantees structurally: a gym gets exactly one
 * lifetime window (its first campaign on or after its first real payment), so
 * there is no way to re-arm this by trying again.
 *
 * Everything the button showed is recomputed here, from the database, before
 * a single Stripe call is made. Nothing the browser sent is trusted for the
 * amounts or the eligibility: they are read fresh, the same way the checkout
 * route decides currency from the gym's country rather than the request.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { gym, session } = await requireOwner();
  const origin = request.nextUrl.origin;
  const back = new URL("/app/settings/billing", origin);

  // The profit-or-nothing guarantee is a Pro feature (the trial grants it too).
  // A Standard gym has a real subscription but no guarantee. See §F0.
  if (!capabilities(gym).hasGuarantee) {
    back.searchParams.set(
      "error",
      "The profit-or-nothing guarantee is on the Pro plan.",
    );
    return NextResponse.redirect(back, 303);
  }

  const status = await loadGuaranteeStatus(session.supabase, gym);

  if (status.state !== "claimable") {
    back.searchParams.set(
      "error",
      status.state === "claimed"
        ? "This has already been claimed."
        : status.state === "needs_review"
          ? "Set your typical booking value in Settings so we can check this, then contact us and we will handle the refund."
          : "There is nothing to claim right now.",
    );
    return NextResponse.redirect(back, 303);
  }

  const admin = supabaseAdmin();

  // Claims the gym's one lifetime slot via the unique(gym_id)
  // constraint on guarantee_claims. If two requests race (a doubled click, a
  // retried form submit), only one gets past this insert; the other lands on
  // the unique-violation branch below and refunds nothing.
  const { data: claim, error: claimError } = await admin
    .from("guarantee_claims")
    .insert({
      gym_id: gym.id,
      created_by: session.userId,
      window_start: status.window.start.toISOString(),
      window_end: status.window.end.toISOString(),
      revenue_recovered_minor: status.revenueRecoveredMinor,
      paid_minor: status.paidMinor,
      status: "processing",
    })
    .select("id")
    .single();

  if (claimError) {
    if (claimError.code === UNIQUE_VIOLATION) {
      back.searchParams.set("error", "This has already been claimed.");
      return NextResponse.redirect(back, 303);
    }
    console.error("[guarantee] claim insert failed", claimError.message);
    back.searchParams.set(
      "error",
      "We could not process that. Try again, and tell us if it keeps happening.",
    );
    return NextResponse.redirect(back, 303);
  }

  // The payments actually inside the window, not yet (fully) refunded. This
  // re-reads from the database rather than trusting status.paidMinor as a
  // single lump sum, because a refund has to point at a real Stripe payment,
  // not an aggregate.
  //
  // gym.premium_started_at, not status.window.start, is the lower
  // bound here for the same reason it is in loadGuaranteeStatus
  // (../../../../lib/guarantee-data.ts): the payment that unlocked Premium
  // always lands before the gym gets around to approving its first
  // campaign, so window.start would silently exclude the one payment this
  // guarantee exists to refund. Getting this wrong here is worse than
  // getting it wrong on the display, because guarantee_claims is a one-shot,
  // never-re-armed slot (see the insert above) — a claim that finds nothing
  // to refund still burns the gym's only chance.
  const { data: allPayments } = await admin
    .from("subscription_payments")
    .select("*")
    .eq("gym_id", gym.id)
    .gte("paid_at", gym.premium_started_at ?? status.window.start.toISOString())
    .lte("paid_at", status.window.end.toISOString());

  // Narrow to the same billing period loadGuaranteeStatus judged as "paid", so
  // the refund can never hand back more than the guarantee was measured against
  // (an extra pre-window month, for a gym slow to launch its first
  // campaign, must not be refunded).
  type PaymentRow = {
    id: string;
    paid_at: string;
    amount_minor: number;
    refunded_minor: number;
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
  };
  const payments = paymentsFundingWindow(
    (allPayments ?? []) as PaymentRow[],
    status.window.start,
  );

  const stripe = stripeClient();
  const refundIds: string[] = [];
  let refundedMinor = 0;
  let allSucceeded = true;

  for (const payment of payments) {
    const owed = payment.amount_minor - payment.refunded_minor;
    if (owed <= 0) continue;

    try {
      const refund = payment.stripe_payment_intent_id
        ? await stripe.refunds.create({
            payment_intent: payment.stripe_payment_intent_id,
          })
        : payment.stripe_charge_id
          ? await stripe.refunds.create({ charge: payment.stripe_charge_id })
          : null;

      if (!refund) {
        console.error(
          "[guarantee] payment has no refundable target",
          payment.id,
        );
        allSucceeded = false;
        continue;
      }

      refundIds.push(refund.id);
      refundedMinor += owed;

      await admin
        .from("subscription_payments")
        .update({ refunded_minor: payment.amount_minor })
        .eq("id", payment.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[guarantee] refund failed", payment.id, detail);
      allSucceeded = false;
    }
  }

  await admin
    .from("guarantee_claims")
    .update({
      refunded_minor: refundedMinor,
      stripe_refund_ids: refundIds,
      status: allSucceeded && refundIds.length > 0 ? "refunded" : "failed",
    })
    .eq("id", claim.id);

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "guarantee.claimed",
    target: claim.id,
    meta: {
      paidMinor: status.paidMinor,
      revenueRecoveredMinor: status.revenueRecoveredMinor,
      refundedMinor,
      succeeded: allSucceeded && refundIds.length > 0,
    },
  });

  if (!allSucceeded || refundIds.length === 0) {
    // The claim is recorded either way, so this never gets tried twice
    // automatically. A human needs to look at this one.
    back.searchParams.set(
      "error",
      "Your claim was recorded but the refund did not complete. We have been told and will sort it out directly.",
    );
    return NextResponse.redirect(back, 303);
  }

  back.searchParams.set("refunded", "1");
  return NextResponse.redirect(back, 303);
}
