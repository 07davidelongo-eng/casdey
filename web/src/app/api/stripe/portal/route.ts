import { NextResponse, type NextRequest } from "next/server";

import { requireOwner } from "@/lib/dal";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hands the practice over to Stripe's own billing portal to change their card,
 * see invoices, or cancel.
 *
 * Cancellation deliberately lives there rather than behind a casdey button. A
 * practice that wants to leave should not have to ask us, and Stripe's page is
 * already the record of what they are paying.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { practice } = await requireOwner();
  const origin = request.nextUrl.origin;

  if (!practice.stripe_customer_id) {
    return NextResponse.redirect(
      new URL("/app/settings/billing", origin),
      303,
    );
  }

  try {
    const portal = await stripeClient().billingPortal.sessions.create({
      customer: practice.stripe_customer_id,
      return_url: `${origin}/app/settings/billing`,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[stripe] portal failed", detail);

    const back = new URL("/app/settings/billing", origin);
    back.searchParams.set(
      "error",
      // The portal needs configuring once per Stripe account, and the error
      // Stripe returns for that is not something a dentist should have to read.
      "We could not open the billing portal. Try again shortly.",
    );
    return NextResponse.redirect(back, 303);
  }
}
