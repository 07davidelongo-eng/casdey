import "server-only";

import { emailProvider, siteUrl } from "../messaging";

/**
 * Sent when a day-7 conversion needs the owner to approve the payment.
 *
 * European cards ask for 3-D Secure routinely, and an off-session charge
 * cannot answer that prompt on the gym's behalf. Stripe leaves the
 * subscription unconfirmed and waits, which gives roughly a day before it
 * expires the attempt. Nothing else in casdey would tell the gym that, so
 * without this email a gym that did everything asked of it simply stops
 * working and is never told why.
 *
 * The tone here matters more than in the nudges. This gym is not a ghost: it
 * imported its list, priced its services and approved a campaign, and it is
 * trying to pay. It should read as a bank formality, which is what it is, and
 * it should never imply the card was refused or that the gym did something
 * wrong.
 */
export async function sendTrialAuthNeeded({
  gym,
  authUrl,
}: {
  gym: { id: string; name: string; contact_email: string };
  /** Stripe's hosted invoice page, which carries the authentication prompt.
   *  Falls back to the billing page when Stripe did not return one. */
  authUrl: string | null;
}): Promise<void> {
  const link = authUrl ?? `${siteUrl()}/app/settings/billing`;

  await emailProvider().send({
    to: gym.contact_email,
    fromName: "casdey",
    subject: "one tap to finish moving onto Pro",
    text: `Hi ${gym.name},

Your free week is up and your account is set up properly, so casdey went to start your Pro subscription. Your bank wants you to approve the first payment before it goes through, which is a routine check on cards in Europe and nothing to do with your card being refused.

It takes one tap:

${link}

Until you do, sending is paused. Everything you have already set up is exactly where you left it, and the moment the payment is approved it all switches back on.

If you would rather not continue onto Pro, ignore this and the payment lapses on its own within a day. You will drop to the free plan and nothing will be charged.

Davide @casdey`,
    replyTo: "info@casdey.com",
  });
}
