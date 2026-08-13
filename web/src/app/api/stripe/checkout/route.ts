import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { currencyFor } from "@/lib/countries";
import {
  TRIAL_DAYS,
  findPlan,
  priceIdFor,
  stripeClient,
  type PlanInterval,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts the free week.
 *
 * A card is collected up front and the subscription begins in `trialing`. Seven
 * days later Stripe charges it without anyone doing anything, which is the
 * behaviour the outreach copy promises ("a free first week", not "a week then
 * we chase you for a card").
 *
 * The currency is decided here from the practice's country, never from the
 * request body: otherwise anyone could post their way onto the cheaper plan.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { practice, session } = await requireOwner();

  const form = await request.formData().catch(() => null);
  const rawInterval = form?.get("interval");
  const interval: PlanInterval = rawInterval === "year" ? "year" : "month";

  const currency = currencyFor(practice.country);
  const plan = findPlan(currency, interval);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const stripe = stripeClient();
  const origin = request.nextUrl.origin;

  try {
    // Reuse the customer if this practice has been here before, so a second
    // attempt does not scatter duplicate customers across the account.
    let customerId = practice.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: practice.contact_email,
        name: practice.name,
        metadata: { practice_id: practice.id, country: practice.country },
      });
      customerId = customer.id;

      await supabaseAdmin()
        .from("practices")
        .update({ stripe_customer_id: customerId })
        .eq("id", practice.id);
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      // Take the card now even though nothing is charged for a week.
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { practice_id: practice.id },
        // If the card fails at the end of the trial, cancel rather than leave
        // an unpaid subscription running. The practice keeps its data and can
        // restart; it just stops sending.
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
      },
      // Belt and braces: the webhook reads this if the subscription metadata is
      // ever missing.
      metadata: { practice_id: practice.id },
      client_reference_id: practice.id,
      allow_promotion_codes: true,
      success_url: `${origin}/app?started=1`,
      cancel_url: `${origin}/app/settings/billing?cancelled=1`,
    });

    if (!checkout.url) {
      throw new Error("Stripe returned a session with no URL");
    }

    await recordAudit({
      practiceId: practice.id,
      actorId: session.userId,
      actorEmail: session.email,
      action: "billing.started",
      meta: { currency, interval },
    });

    // 303 so the browser turns the form POST into a GET on Stripe's page.
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[stripe] checkout failed", detail);

    const back = new URL("/app/settings/billing", origin);
    back.searchParams.set(
      "error",
      "We could not open the payment page. Try again, and tell us if it keeps happening.",
    );
    return NextResponse.redirect(back, 303);
  }
}
