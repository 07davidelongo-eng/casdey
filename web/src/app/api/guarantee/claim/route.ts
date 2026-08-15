import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin, UNIQUE_VIOLATION } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { loadGuaranteeStatus } from "@/lib/guarantee-data";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The profit-or-nothing guarantee, self-service: one click, and if the
 * practice genuinely qualifies, the refund fires immediately with nobody at
 * casdey reviewing it first. That is only safe because of what
 * src/lib/guarantee.ts guarantees structurally: a practice gets exactly one
 * lifetime window (its first campaign on or after its first real payment), so
 * there is no way to re-arm this by trying again.
 *
 * Everything the button showed is recomputed here, from the database, before
 * a single Stripe call is made. Nothing the browser sent is trusted for the
 * amounts or the eligibility: they are read fresh, the same way the checkout
 * route decides currency from the practice's country rather than the request.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { practice, session } = await requireOwner();
  const origin = request.nextUrl.origin;
  const back = new URL("/app/settings/billing", origin);

  const status = await loadGuaranteeStatus(session.supabase, practice);

  if (status.state !== "claimable") {
    back.searchParams.set(
      "error",
      status.state === "claimed"
        ? "This has already been claimed."
        : "There is nothing to claim right now.",
    );
    return NextResponse.redirect(back, 303);
  }

  const admin = supabaseAdmin();

  // Claims the practice's one lifetime slot via the unique(practice_id)
  // constraint on guarantee_claims. If two requests race (a doubled click, a
  // retried form submit), only one gets past this insert; the other lands on
  // the unique-violation branch below and refunds nothing.
  const { data: claim, error: claimError } = await admin
    .from("guarantee_claims")
    .insert({
      practice_id: practice.id,
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
  const { data: payments } = await admin
    .from("subscription_payments")
    .select("*")
    .eq("practice_id", practice.id)
    .gte("paid_at", status.window.start.toISOString())
    .lte("paid_at", status.window.end.toISOString());

  const stripe = stripeClient();
  const refundIds: string[] = [];
  let refundedMinor = 0;
  let allSucceeded = true;

  for (const payment of payments ?? []) {
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
    practiceId: practice.id,
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
