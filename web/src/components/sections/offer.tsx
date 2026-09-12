import Link from "next/link";

import { IconShield } from "../marks/icons";
import { Reveal } from "../motion";
import { ButtonLink, Container } from "../ui";
import { paidTrialEnabled } from "@/lib/plan";
import { startCta, trialPriceDisplay } from "@/lib/offer-copy";
import { conversionAmountMinor } from "@/lib/trial";
import { formatMoney } from "@/lib/money";

/**
 * One surface, three facts.
 *
 * This was a grey card, a solid gold card and a cream card stacked in a row,
 * which put four different backgrounds on screen at once and made the offer
 * look more complicated than it is. Everything now sits on a single white
 * panel divided by hairlines, and gold appears only at label size. The one
 * colour break left on the page is the closing band, which is the point of
 * having it.
 */
export function Offer() {
  const paidTrial = paidTrialEnabled();
  const price = trialPriceDisplay();
  // The LIST price, deliberately. An earlier pass showed the discounted figure
  // here on the reasoning that every signup today holds the launch discount.
  // Davide's call, and it is the right one: the list price is what the plan
  // costs, and a site that quietly quotes the discounted number has nothing
  // left to say when it wants to point out that there is a discount. The
  // announcement bar carries that, once, where it applies to every plan.
  const proMonthlyMinor = conversionAmountMinor("eur", false);
  const proMonthly =
    proMonthlyMinor == null ? null : formatMoney(proMonthlyMinor, "eur");

  return (
    <section id="pricing" className="scroll-mt-24 pb-24 sm:pb-32">
      <Container>
        <Reveal>
          {/* Same reasoning as section-intro.tsx: the heading gets the section,
              the paragraph gets a measure. */}
          <div>
            <h2 className="display text-[clamp(1.6rem,2.6vw,2.15rem)] text-ink text-pretty">
              {paidTrial
                ? `A week of everything for ${price}.`
                : "Free for a week. Then free until you say otherwise."}
            </h2>
            <p className="mt-5 max-w-[34rem] text-[1.0625rem] leading-relaxed text-graphite text-pretty">
              {paidTrial
                ? "Long enough to import your list, see who has gone quiet, and write to them. Cancel before the week is out and that is all you pay."
                : "No card to start, and no bill when the week ends. You only pay when you have seen what casdey found in your own list."}
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-[20px] border border-ash bg-white">
            <div className="grid sm:grid-cols-2">
              <div className="border-b border-ash p-8 sm:border-b-0 sm:border-r sm:p-10">
                <p className="label text-stone">The first week</p>
                <p className="display mt-4 text-[2.25rem] leading-none text-ink">
                  {paidTrial ? price : "Free"}
                </p>
                <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-graphite">
                  {paidTrial
                    ? "Everything casdey does, for seven days. One click cancels it, and nothing else is charged."
                    : "Everything casdey does, with no card, no setup fee and no commitment at the end of it."}
                </p>
              </div>

              <div className="p-8 sm:p-10">
                <p className="label text-stone">After the week</p>
                <p className="display mt-4 text-[2.25rem] leading-none text-ink">
                  {paidTrial ? (proMonthly ?? "Pro") : "Still free"}
                </p>
                <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-graphite">
                  {paidTrial
                    ? "Pro continues monthly, less any launch discount you are holding. Cancel during the week and it never starts."
                    : "Your account drops to the Free plan, not a bill. Upgrade whenever it earns it, and starting now locks a lifetime discount for when you do."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-5 border-t border-ash p-8 sm:flex-row sm:items-start sm:gap-7 sm:p-10">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ash text-teal">
                <IconShield className="h-5 w-5" />
              </span>
              <div>
                {/* "on Pro" is not a detail. The guarantee is a Pro feature
                    (Track F); a Standard gym pays and is not covered. The
                    pricing page has always said so, and this block said it
                    unconditionally, which is the half a buyer reads first. */}
                <p className="label text-teal">The guarantee, on Pro</p>
                <p className="display mt-2 text-[1.5rem] leading-tight text-ink">
                  Profit or nothing.
                </p>
                <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-graphite">
                  On Pro, if casdey does not recover more than it costs, you do
                  not pay. No ad budget and no agency retainer stacked on top,
                  just the subscription, backed by that.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <ButtonLink href="/login?mode=signup" size="sm">
              {startCta(paidTrial)}
            </ButtonLink>
            <Link
              href="/pricing"
              className="text-[0.9375rem] text-teal transition-colors duration-200 hover:text-teal-hover"
            >
              Compare the plans &rarr;
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
