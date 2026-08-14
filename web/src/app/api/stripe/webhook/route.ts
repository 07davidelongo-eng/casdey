import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { stripeClient } from "@/lib/stripe";
import { supabaseAdmin, UNIQUE_VIOLATION } from "@/lib/supabase";
import type { SubscriptionStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe's view of the world, written back onto the practice.
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
      // This is here so a practice is not left looking healthy if it does not.
      await supabaseAdmin()
        .from("practices")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", customerId)
        .in("subscription_status", ["active", "trialing"]);
      return;
    }
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
  fallbackPracticeId?: string,
): Promise<void> {
  const practiceId =
    subscription.metadata?.practice_id ?? fallbackPracticeId ?? null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const item = subscription.items.data[0];
  const price = item?.price;

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
  };

  const query = supabaseAdmin().from("practices").update(update);

  // Prefer the id Stripe is carrying for us. Fall back to the customer, which
  // covers a subscription created by hand in the dashboard.
  const { error } = practiceId
    ? await query.eq("id", practiceId)
    : await query.eq("stripe_customer_id", customerId);

  if (error) {
    throw new Error(`practice update failed: ${error.code} ${error.message}`);
  }
}
