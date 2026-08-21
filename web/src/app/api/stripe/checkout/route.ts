import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { currencyFor } from "@/lib/countries";
import { earlyAdopterProgramActive } from "@/lib/plan";
import {
  couponIdFor,
  findPlan,
  priceIdFor,
  stripeClient,
  type PlanInterval,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upgrades a gym to Premium.
 *
 * This is a straight paid subscription: the free week happened earlier and was
 * casdey's to give, so there is no Stripe trial here and the card is charged
 * now. An early-adopter gym gets its lifetime discount coupon applied, so
 * the reduced price rides on the subscription for as long as it stays.
 *
 * The currency is decided here from the gym's country, never from the
 * request body: otherwise anyone could post their way onto the cheaper plan.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { gym, session } = await requireOwner();

  const form = await request.formData().catch(() => null);
  const rawInterval = form?.get("interval");
  const interval: PlanInterval = rawInterval === "year" ? "year" : "month";

  const currency = currencyFor(gym.country);
  const plan = findPlan(currency, interval);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const stripe = stripeClient();
  const origin = request.nextUrl.origin;

  try {
    // Reuse the customer if this gym has been here before, so a second
    // attempt does not scatter duplicate customers across the account.
    let customerId = gym.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: gym.contact_email,
        name: gym.name,
        metadata: { gym_id: gym.id, country: gym.country },
      });
      customerId = customer.id;

      await supabaseAdmin()
        .from("gyms")
        .update({ stripe_customer_id: customerId })
        .eq("id", gym.id);
    }

    // The lifetime discount, only for a flagged early adopter and only while the
    // programme is still running. Once applied to the subscription it persists
    // for the life of that subscription, which is what makes it "lifetime".
    const coupon =
      gym.early_adopter && earlyAdopterProgramActive()
        ? couponIdFor(currency)
        : undefined;

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      subscription_data: { metadata: { gym_id: gym.id } },
      // A coupon and manual promotion codes cannot both be offered at once, so
      // the automatic early-adopter discount takes precedence when it applies.
      ...(coupon
        ? { discounts: [{ coupon }] }
        : { allow_promotion_codes: true }),
      // Belt and braces: the webhook reads this if the subscription metadata is
      // ever missing.
      metadata: { gym_id: gym.id },
      client_reference_id: gym.id,
      success_url: `${origin}/app/settings/billing?upgraded=1`,
      cancel_url: `${origin}/app/settings/billing?cancelled=1`,
    });

    if (!checkout.url) {
      throw new Error("Stripe returned a session with no URL");
    }

    await recordAudit({
      gymId: gym.id,
      actorId: session.userId,
      actorEmail: session.email,
      action: "billing.started",
      meta: { currency, interval, discounted: Boolean(coupon) },
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
