import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { currencyFor } from "@/lib/countries";
import { paidTrialEnabled } from "@/lib/plan";
import { stripeClient } from "@/lib/stripe";
import { TRIAL_PRICE_MINOR } from "@/lib/trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts the free week by taking €1 and saving the card.
 *
 * One PaymentIntent does both jobs (`setup_future_usage: "off_session"`),
 * which is simpler than a SetupIntent plus a separate charge and, unlike a €0
 * authorisation, actually proves the card works. €1 rather than nothing is
 * Hormozi's own hedge (MM pg 129) against the obvious objection, that asking
 * for a card on a free trial costs signups: it is small enough to read as a
 * formality and real enough to be a commitment.
 *
 * Hosted Checkout rather than Stripe Elements, matching the upgrade path
 * already in this codebase: no card details ever reach casdey's own server,
 * which is the whole reason to prefer it.
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

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: TRIAL_PRICE_MINOR,
            product_data: {
              name: "casdey free week",
              description:
                "Confirms your card so your free week can start. Nothing else is charged today.",
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        // What makes this one step rather than two: the same charge that
        // proves the card works also saves it for the day-7 conversion.
        setup_future_usage: "off_session",
        metadata: { gym_id: gym.id, kind: "trial_deposit" },
      },
      // Read by the webhook, which is the authoritative writer. See
      // recordTrialCard() in src/lib/trial-start.ts.
      metadata: { gym_id: gym.id, kind: "trial_deposit" },
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
