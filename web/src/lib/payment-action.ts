import "server-only";

import { stripeClient } from "./stripe";
import type { Gym } from "./types";

/**
 * Whether a gym has a payment sitting unpaid because its bank wants the owner
 * to authorise it, and the link that lets them do it.
 *
 * **This is a designed-for path, not an edge case**, which is why it has its
 * own module rather than living inside the billing page. Under PSD2 a European
 * issuer decides for itself whether to waive authentication on an off-session
 * renewal, and casdey's first week costs 1 euro while the renewal costs a few
 * hundred. Stripe's exemption for recurring charges is the FIXED AMOUNT one,
 * which wants every charge in the series to be the same, so casdey's own shape
 * argues against itself and a challenge at the first renewal should be
 * expected rather than hoped against. Confirmed the hard way on 2026-09-12: a
 * real Revolut card refused the exemption on both architectures tried.
 *
 * Shopify does exactly this too, and emails a link. casdey emails one as well
 * (see email/trial-auth.ts), but an email is a thin place for the only copy of
 * something that silently stops a gym sending, so the product says it too.
 *
 * Read live from Stripe rather than stored, deliberately. The alternative is a
 * column that has to be kept in step with an invoice whose state changes
 * without casdey being involved, and a stale "authorise your payment" banner
 * pointing at an invoice that is already paid is worse than none.
 */

export type PaymentAction = {
  /** Stripe's hosted page, which is the only surface that can run the
   *  3-D Secure challenge for us. */
  url: string;
  amountMinor: number;
  currency: "eur" | "gbp";
};

/** Statuses where an unpaid invoice is plausible. Anything else skips the
 *  Stripe round trip entirely, so a healthy gym never pays for this check. */
function couldOwe(status: Gym["subscription_status"]): boolean {
  return status === "past_due" || status === "incomplete";
}

export async function pendingPaymentAction(
  gym: Pick<Gym, "stripe_customer_id" | "subscription_status">,
): Promise<PaymentAction | null> {
  if (!gym.stripe_customer_id || !couldOwe(gym.subscription_status)) return null;

  try {
    const invoices = await stripeClient().invoices.list({
      customer: gym.stripe_customer_id,
      status: "open",
      limit: 1,
    });

    const invoice = invoices.data[0];
    if (!invoice?.hosted_invoice_url || invoice.amount_due <= 0) return null;

    const currency = invoice.currency === "gbp" ? "gbp" : "eur";
    return {
      url: invoice.hosted_invoice_url,
      amountMinor: invoice.amount_due,
      currency,
    };
  } catch (error) {
    // Never break the billing page over this. A gym that cannot see the
    // banner still has the email, and still has the portal.
    console.error(
      "[billing] could not read the open invoice",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
