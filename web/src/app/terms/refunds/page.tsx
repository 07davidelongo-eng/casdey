import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { paidTrialEnabled } from "@/lib/plan";
import { TRIAL_PRICE_MINOR } from "@/lib/trial";

/*
 * The refund policy. One exception, everything else non-refundable.
 *
 * The first-week section reads CASDEY_PAID_TRIAL and src/lib/trial.ts
 * directly, rather than restating their numbers, for the same reason: a fee
 * this page understates is a fee casdey should not be charging.
 *
 * Every claim here is checked against lib/guarantee.ts and the billing page
 * copy (src/app/app/settings/billing/page.tsx): it is a promise about money,
 * so the wording cannot drift from the code that pays it. The one refundable
 * path is the Pro profit-or-nothing guarantee, self-served from the gym's own
 * billing page, one 30-day window per gym, ever.
 *
 * No registered entity or postal address yet (no P.IVA), the same deferral as
 * /terms/processing. Contact is info@casdey.com.
 */

export const metadata: Metadata = {
  title: "Refund policy",
  description:
    "When casdey refunds a subscription and when it does not. The Pro profit-or-nothing guarantee is the one refundable path; everything else is paid in advance and non-refundable.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "12 September 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-14 text-[1.5rem] text-ink">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[1rem] leading-relaxed text-graphite">{children}</p>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex gap-3 text-[1rem] leading-relaxed text-graphite"
        >
          <span
            aria-hidden="true"
            className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RefundPolicyPage() {
  return (
    <>
      <SiteHeader sections={false} paidTrial={paidTrialEnabled()} />
      <main className="py-20 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <p className="label text-stone">last updated {LAST_UPDATED}</p>
            <h1 className="display mt-4 text-[clamp(2rem,5vw,3rem)] text-ink">
              Refund policy
            </h1>
            <P>
              casdey subscriptions are paid in advance and are not refundable,
              with one exception: the profit-or-nothing guarantee on the Pro
              plan. This page sets out how that works and what it does not
              cover.
            </P>

            <H2>The one refundable path: the Pro guarantee</H2>
            <P>
              The Pro plan carries a profit-or-nothing guarantee. Your first
              campaign after your first Pro payment opens a single 30-day
              window. If, over that window, casdey has not recovered more in
              revenue than it charged you, you claim a full refund of everything
              you paid during it.
            </P>
            <List
              items={[
                "You decide. The claim is a button on your own billing page and it pays on the first click. Nobody at casdey reviews it.",
                "What is measured is revenue casdey recovered over the window against what casdey charged you over the same window. Not traffic, opens or replies.",
                "One window per gym, ever. It opens once, with your first campaign after your first payment, and can never be re-armed.",
                "The refund covers the payments taken during that window, and no more.",
              ]}
            />
            <P>
              The guarantee is a Pro feature. The Standard plan does not include
              it, and there is no equivalent refund on Standard.
            </P>

            <H2>Everything else is non-refundable</H2>
            <P>
              Outside the guarantee window, subscription payments are not
              refunded, in whole or in part.
            </P>
            <List
              items={[
                "Standard and Pro are billed in advance, monthly or yearly. Cancelling stops the next renewal. You keep the plan until the end of the period you have already paid for, then move to the Free plan.",
                "There is no partial or pro-rata refund for the unused part of a billing period, whether you cancel or downgrade.",
                "Moving from Pro to Standard takes effect immediately. The difference for the current period is not refunded.",
                "An annual plan is one payment for twelve months. Cancelling part way through ends the renewal, not the current term, and the current term is not refunded.",
              ]}
            />

            <H2>The free plan and the first week</H2>
            {paidTrialEnabled() ? (
              <>
                <P>
                  A new account buys its first week of Pro for{' '}
                  <span className="literal">
                    {formatMoney(TRIAL_PRICE_MINOR, 'eur')}
                  </span>
                  . That is the only amount taken at signup, and it is not
                  refundable, because the week it pays for begins immediately.
                </P>
                <P>
                  At the end of the week the subscription continues on Pro at
                  the standard monthly rate, less any discount you hold, and
                  your card is charged. Cancel at any point during the week and
                  it does not: you keep Pro until the week runs out, move to the
                  Free plan, and pay nothing beyond the first{' '}
                  <span className="literal">
                    {formatMoney(TRIAL_PRICE_MINOR, 'eur')}
                  </span>
                  . UK accounts are charged the equivalent figures in pounds.
                </P>
                <P>
                  Cancelling takes one click on your billing page. Emails during
                  the week state what will happen, including one on the last day
                  naming the exact amount and date, so the renewal is never the
                  first you hear of it.
                </P>
                <P>
                  Accounts opened before this came into effect keep the terms
                  they signed up to: a free week with no card and no automatic
                  conversion to a paid plan.
                </P>
              </>
            ) : (
              <P>
                Every account starts with a free week that takes no card, and
                the Free plan afterwards costs nothing. There is nothing to
                refund on either. If the free week ends and you do not upgrade,
                you are not charged.
              </P>
            )}

            <H2>The early-adopter discount</H2>
            <P>
              Gyms that join during the launch window keep a lifetime 20%
              discount on either paid tier. It lowers what you pay; it does not
              change anything on this page. The guarantee is still the only
              refundable path.
            </P>

            <H2>Billing errors</H2>
            <P>
              If you have been charged in error, charged twice, or charged after
              cancelling, that is not a refund question and this policy does not
              limit it. Email{" "}
              <a
                href="mailto:info@casdey.com"
                className="text-teal underline underline-offset-4"
              >
                info@casdey.com
              </a>{" "}
              and it will be put right.
            </P>

            <H2>Your legal rights</H2>
            <P>
              Nothing here removes or limits any right you have by law. Where a
              mandatory statutory right to a refund applies to you, it stands
              regardless of what this policy says.
            </P>

            <H2>Getting in touch</H2>
            <P>
              Questions about a payment or a refund go to{" "}
              <a
                href="mailto:info@casdey.com"
                className="text-teal underline underline-offset-4"
              >
                info@casdey.com
              </a>
              , and reach a person rather than a queue. The{" "}
              <Link
                href="/pricing"
                className="text-teal underline underline-offset-4"
              >
                pricing page
              </Link>{" "}
              has the current figures and the full guarantee terms.
            </P>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
