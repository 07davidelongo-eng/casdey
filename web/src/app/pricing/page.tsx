import type { Metadata } from "next";

import { PricingTable } from "@/components/pricing-table";
import { CtaBand } from "@/components/sections/cta-band";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui";
import { TRIAL_DAYS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "casdey pricing: a free plan that finds your lapsed members, and two paid tiers that win them back. Free for the first week, no card.",
};

/**
 * The full pricing page.
 *
 * The landing page keeps its own short offer panel, deliberately: someone
 * scrolling the homepage wants to know it starts free, not to read a
 * comparison table. This is the page for the person who has decided to
 * compare, and it is the only place the actual figures appear on the public
 * site.
 */

const FAQ = [
  {
    q: "What happens when the free week ends?",
    a: "Your account drops to the Free plan. Nothing is charged, nothing is deleted, and no card was taken to begin with. You keep your imported list and everything casdey found in it; what stops is the sending.",
  },
  {
    q: "Is there a discount for joining early?",
    a: "Yes. Gyms that start during the launch window keep a lifetime 20% discount on either paid tier, applied automatically whenever they upgrade, for as long as they stay subscribed.",
  },
  {
    q: "What does the profit-or-nothing guarantee actually cover?",
    a: "On Pro, your first campaign after your first payment opens one 30-day window. If casdey has not recovered more than it cost you over that window, you claim a full refund of what you paid in it, from your own billing page, with no review. One window per gym, ever.",
  },
  {
    q: "Do I need to change my gym software?",
    a: "No. casdey reads an export from whatever you already use, or a CSV, and writes bookings into your Google Calendar. It does not sit between you and your members' records, and it never writes back to them.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Any time, from your billing page. Moving between Standard and Pro takes effect immediately, and cancelling leaves you on the Free plan rather than locking you out of your own data.",
  },
];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden pt-14 sm:pt-20">
          <div
            aria-hidden="true"
            className="grain pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,color-mix(in_srgb,var(--teal-bright)_14%,transparent),transparent_72%)]"
          />

          <Container className="relative">
            <div className="mx-auto max-w-[42rem] text-center">
              <h1 className="display text-[clamp(1.9rem,3.4vw,2.9rem)] text-ink">
                Pay once it has already worked.
              </h1>
              <p className="mx-auto mt-5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-graphite text-pretty">
                Every plan starts with {TRIAL_DAYS} days of everything casdey
                does, with no card. After that you decide, and the free plan is
                a real one.
              </p>
            </div>

            <div className="mt-12">
              <PricingTable />
            </div>

            <p className="mt-5 text-center text-[0.8125rem] text-stone">
              Prices exclude VAT. Gyms joining now keep a lifetime 20% discount
              on either paid tier.
            </p>
          </Container>
        </section>

        <section className="py-24 sm:py-32">
          <Container>
            <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
              <h2 className="display text-[clamp(1.6rem,2.6vw,2.15rem)] text-ink text-balance">
                Questions a gym owner actually asks.
              </h2>

              <dl className="overflow-hidden rounded-[20px] border border-ash bg-white">
                {FAQ.map((item, i) => (
                  <div
                    key={item.q}
                    className={"p-7 sm:p-8 " + (i ? "border-t border-ash" : "")}
                  >
                    <dt className="text-[1.0625rem] font-medium text-ink">
                      {item.q}
                    </dt>
                    <dd className="mt-2.5 text-[0.9375rem] leading-relaxed text-graphite">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Container>
        </section>

        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
