import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { currencyFor } from "@/lib/countries";
import { TRIAL_DAYS, paidTrialEnabled } from "@/lib/plan";
import { findPricePlan, priceIdFor, stripeClient } from "@/lib/stripe";
import { TRIAL_PRICE_MINOR } from "@/lib/trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts the paid first week: 1 euro now, and the Pro subscription created at
 * the same moment with a 7-day Stripe trial on it.
 *
 * **One Checkout session does both**, which is the point of the design.
 * `mode: "subscription"` with `trial_period_days` plus a one-off line item
 * charges the euro immediately and leaves a real subscription sitting in
 * `trialing`. Stripe then bills it at day 7 by itself.
 *
 * Why it is shaped this way, because the obvious alternative is what casdey
 * did first and it broke. Taking the euro as a standalone payment and creating
 * the subscription a week later means the day 7 charge reaches the issuer as a
 * fresh merchant-initiated transaction, for 231 times the amount it approved,
 * a week later, with nobody present. The first real card tried was challenged
 * for 3-D Secure. Creating the subscription up front means the card is
 * authenticated on-session, while the owner is there to answer the bank, and
 * the later charge runs against a mandate that belongs to that subscription.
 * Stripe documents this as the normal way to run a paid trial and its own
 * worked example is "a 7-day trial for 1 USD".
 *
 * **The coupon is deliberately NOT set on the session.** A session-level
 * discount applies to every line, so a 20% early-adopter coupon would quietly
 * turn the 1 euro into 80 cents. `subscription_data[discounts]` does not exist
 * on the pinned API version (checked, it is rejected as an unknown parameter),
 * so the webhook attaches the coupon to the subscription after checkout. There
 * is a week before the first real invoice, so there is plenty of slack.
 *
 * Hosted Checkout rather than Stripe Elements, matching the upgrade path
 * already in this codebase: no card details ever reach casdey's own server.
 *
 * The commitment answer is recorded BEFORE the redirect, because it is the
 * part with no second chance: once the gym is on Stripe's page casdey cannot
 * ask it anything.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { gym, session } = await requireOwner();
  const origin = request.nextUrl.origin;

  if (!paidTrialEnabled()) {
    // Nothing to do: with the flag off the week is granted at signup and no
    // card is taken. Send them into the product rather than erroring.
    return NextResponse.redirect(new URL("/app", origin), 303);
  }

  // Already started. A refresh of this form must not charge a second euro.
  if (gym.trial_card_setup_at) {
    return NextResponse.redirect(new URL("/app", origin), 303);
  }

  const form = await request.formData().catch(() => null);
  const committed = form?.get("commitment") === "yes";
  const acceptedTerms = form?.get("terms") === "yes";

  if (!acceptedTerms) {
    const back = new URL("/app/onboarding/trial", origin);
    back.searchParams.set("error", "terms");
    return NextResponse.redirect(back, 303);
  }

  const currency = currencyFor(gym.country);
  const stripe = stripeClient();

  try {
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

    // The affirmative commitment, stored whether or not the card goes
    // through. It is the asking that does the work, and a gym that answered
    // and then abandoned the card is worth knowing about.
    if (committed) {
      await supabaseAdmin()
        .from("gyms")
        .update({ trial_commitment_at: new Date().toISOString() })
        .eq("id", gym.id)
        .is("trial_commitment_at", null);
    }

    const plan = findPricePlan("pro", currency, "month");
    if (!plan) throw new Error(`no Pro month price for ${currency}`);

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        // The subscription itself, which Stripe holds in `trialing` and bills
        // on its own at day 7.
        { price: priceIdFor(plan), quantity: 1 },
        // The euro, charged now. A one-off line in a subscription session is
        // invoiced immediately even though the trial has not ended, which is
        // what lets one Checkout do both jobs.
        {
          price_data: {
            currency,
            unit_amount: TRIAL_PRICE_MINOR,
            product_data: {
              name: "casdey first week",
              description:
                "Your first week of Pro. The subscription starts when the week ends, and you can cancel before then.",
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        // The webhook resolves the tier from the price id first and falls back
        // to this, so a missing STRIPE_PRICE_* var cannot leave plan_tier null,
        // which effectivePlan() would read as Pro.
        metadata: { gym_id: gym.id, plan_tier: "pro", source: "paid_trial" },
      },
      // No `discounts` here on purpose: a session-level coupon discounts every
      // line, including the euro. The webhook puts it on the subscription.
      metadata: { gym_id: gym.id, kind: "paid_trial" },
      client_reference_id: gym.id,
      success_url: `${origin}/app/onboarding/trial/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/onboarding/trial?error=cancelled`,
    });

    if (!checkout.url) throw new Error("Stripe returned a session with no URL");

    await recordAudit({
      gymId: gym.id,
      actorId: session.userId,
      actorEmail: session.email,
      action: "trial.started",
      meta: { currency, committed },
    });

    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[trial] could not open checkout", detail);

    const back = new URL("/app/onboarding/trial", origin);
    back.searchParams.set("error", "stripe");
    return NextResponse.redirect(back, 303);
  }
}
