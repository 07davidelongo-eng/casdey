import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { planTierForPriceId, stripeClient } from "@/lib/stripe";
import { supabaseAdmin, UNIQUE_VIOLATION } from "@/lib/supabase";
import type { SubscriptionStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe's view of the world, written back onto the gym.
 *
 * This endpoint is the only thing that may change `subscription_status`.
 * Anything else guessing at it ends up with an account that says "active" while
 * Stripe says the card bounced three weeks ago.
 *
 * Three things this has to get right:
 *
 *   1. Verify the signature against the raw body. Parsing the JSON first and
 *      re-serialising it changes the bytes and the signature no longer matches,
 *      which is why `request.text()` is used and not `request.json()`.
 *   2. Be idempotent. Stripe retries, and events can arrive out of order or
 *      twice. Every event id is recorded, and a repeat is dropped.
 *   3. Never fail loudly at Stripe for something that is our problem. A 500
 *      makes Stripe retry for days; a 200 with a logged error does not.
 */

const RELEVANT = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.paid",
]);

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      raw,
      signature,
      secret,
    );
  } catch (error) {
    // Either a forged request or a mismatched secret. Both are a 400.
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[stripe] signature verification failed", detail);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!RELEVANT.has(event.type)) {
    return Response.json({ received: true, ignored: event.type });
  }

  // Claim the event. A duplicate delivery loses the race and stops here.
  const { error: claimError } = await supabaseAdmin()
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (claimError) {
    if (claimError.code === UNIQUE_VIOLATION) {
      return Response.json({ received: true, duplicate: true });
    }
    console.error("[stripe] could not record event", claimError.message);
    // Ask Stripe to try again: without the idempotency record we might
    // otherwise process this twice.
    return new Response("Storage unavailable", { status: 503 });
  }

  try {
    await handle(event);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[stripe] handling ${event.type} failed`, detail);
    // Deliberately a 200. The event is recorded, so a retry would be dropped as
    // a duplicate anyway. Failures here need a human, not another delivery.
  }

  return Response.json({ received: true });
}

async function handle(event: Stripe.Event): Promise<void> {
  const stripe = stripeClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!subscriptionId) return;

      const subscription =
        await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(
        subscription,
        session.client_reference_id ?? undefined,
      );
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object);
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
      if (!customerId) return;

      // The matching subscription.updated normally carries the real status.
      // This is here so a gym is not left looking healthy if it does not.
      await supabaseAdmin()
        .from("gyms")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", customerId)
        .in("subscription_status", ["active", "trialing"]);
      return;
    }

    case "invoice.paid": {
      // Re-fetched rather than trusting the webhook payload's own `payments`
      // list, for the same reason checkout.session.completed re-fetches the
      // subscription above: a guaranteed-fresh, guaranteed-populated object
      // rather than whatever shape happened to arrive over the wire.
      //
      // expand: ["payments"] is not optional. Without it Stripe's REST API
      // omits the payments list entirely (confirmed against a real invoice:
      // the field comes back undefined), which silently zeroes out both
      // stripe_payment_intent_id and stripe_charge_id below on every payment
      // this ever records — and a subscription_payments row with neither is
      // exactly what src/app/api/guarantee/claim/route.ts calls "no
      // refundable target" and refuses to refund.
      const invoice = await stripe.invoices.retrieve(event.data.object.id, {
        expand: ["payments"],
      });
      await recordInvoicePayment(invoice);
      return;
    }
  }
}

/**
 * Records what a paid invoice actually collected, and against which Stripe
 * payment. This is the money half of the profit-or-nothing guarantee (see
 * src/lib/guarantee.ts) — without a row here, there is nothing for a refund
 * to point at.
 */
async function recordInvoicePayment(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const currency = invoice.currency === "gbp" ? "gbp" : "eur";
  const paidAt = toIso(invoice.status_transitions?.paid_at) ?? toIso(invoice.created);

  // Whichever of these Stripe actually settled the invoice with. See the
  // InvoicePayment.Payment union in the Stripe SDK: exactly one is set.
  const settlement = invoice.payments?.data[0]?.payment;
  const paymentIntentId =
    settlement?.type === "payment_intent"
      ? typeof settlement.payment_intent === "string"
        ? settlement.payment_intent
        : settlement.payment_intent?.id
      : null;
  const chargeId =
    settlement?.type === "charge"
      ? typeof settlement.charge === "string"
        ? settlement.charge
        : settlement.charge?.id
      : null;

  const { data: gym, error: lookupError } = await supabaseAdmin()
    .from("gyms")
    .select("id, premium_started_at")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`gym lookup failed: ${lookupError.message}`);
  }
  if (!gym) return; // No gym on this customer yet; nothing to record against.

  const { error: insertError } = await supabaseAdmin()
    .from("subscription_payments")
    .upsert(
      {
        gym_id: gym.id,
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
        amount_minor: invoice.amount_paid,
        currency,
        paid_at: paidAt ?? new Date().toISOString(),
      },
      { onConflict: "stripe_invoice_id", ignoreDuplicates: true },
    );

  if (insertError) {
    throw new Error(`subscription_payments insert failed: ${insertError.message}`);
  }

  // Set once, never overwritten: the guarantee clock's earliest possible
  // start is the first real payment, full stop.
  if (!gym.premium_started_at) {
    await supabaseAdmin()
      .from("gyms")
      .update({ premium_started_at: paidAt ?? new Date().toISOString() })
      .eq("id", gym.id)
      .is("premium_started_at", null);
  }
}

/** Stripe has more states than the product needs. Collapse them honestly. */
function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
      return "incomplete";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "canceled";
  }
}

function toIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  fallbackGymId?: string,
): Promise<void> {
  const gymId =
    subscription.metadata?.gym_id ?? fallbackGymId ?? null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const item = subscription.items.data[0];
  const price = item?.price;

  // Track F: which paid tier this subscription's price belongs to. Null until
  // F2 sets the STRIPE_PRICE_<TIER>_* env vars, at which point effectivePlan()
  // stops defaulting an active subscription to Pro and reads this instead.
  const planTier = planTierForPriceId(price?.id);

  const update = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    subscription_status: mapStatus(subscription.status),
    // trial_ends_at is deliberately not touched here: the free week is
    // casdey-managed and pre-Stripe, so a subscription event must never
    // overwrite it. As of API version 2026-07-29 the billing period lives on
    // the subscription item, not on the subscription itself.
    current_period_end: toIso(item?.current_period_end),
    plan_currency: price?.currency === "gbp" ? "gbp" : "eur",
    plan_interval: price?.recurring?.interval === "year" ? "year" : "month",
    // Only write plan_tier when a tier actually resolves, so a not-yet-
    // configured price never nulls out a tier set by a later, configured event.
    ...(planTier ? { plan_tier: planTier } : {}),
  };

  const query = supabaseAdmin().from("gyms").update(update);

  // Prefer the id Stripe is carrying for us. Fall back to the customer, which
  // covers a subscription created by hand in the dashboard.
  const { error } = gymId
    ? await query.eq("id", gymId)
    : await query.eq("stripe_customer_id", customerId);

  if (error) {
    throw new Error(`gym update failed: ${error.code} ${error.message}`);
  }
}
