import Link from "next/link";

import { EARLY_ADOPTER_DISCOUNT_PERCENT } from "@/lib/trial";

/**
 * The launch-window strip above the header.
 *
 * Rendered only while `earlyAdopterProgramActive()` is true, so it disappears
 * on its own when the window closes rather than needing a copy change.
 *
 * Colour is the one place this page uses Leaf, the FILL gold, and the brand
 * guide is strict about it: Leaf carries near-black, never the reverse. That
 * pairing is 8.7:1, so the bar can be the loudest thing on the page without
 * being the least readable. Struck Gold (--teal) is the READ value and would
 * be wrong here, because at this size a gold-on-chalk strip reads as a
 * disabled state rather than an offer.
 *
 * What it does NOT say is anything about scarcity. There is no countdown, no
 * seat count and no "ends soon", because none of those would be true: the
 * window is a flag Davide turns off, not a deadline, and the brand rule is
 * that a number which is not real does not go on the page. The genuinely
 * unusual thing about the offer is that the discount is permanent, so that is
 * what the line leads with.
 */
export function AnnouncementBar() {
  return (
    <div className="bg-teal-bright text-ink">
      {/* Deliberately one line at every width, and that is load-bearing rather
          than cosmetic. The bar sits inside a FIXED header whose height is
          reserved by a spacer of a known size, so a bar that wraps pushes the
          header over the top of the page content. Measured at 375px before
          this was split: three lines, 36px of overlap, enough to clip the
          first heading on the terms and privacy pages. Hence a short form
          below sm rather than one string left to reflow. */}
      <div className="mx-auto flex w-full max-w-[76rem] items-center justify-center gap-x-2 px-6 py-2 text-center text-[0.8125rem] leading-snug sm:px-8">
        <span className="sm:hidden">
          {EARLY_ADOPTER_DISCOUNT_PERCENT}% off all plans, while you stay.
        </span>
        <span className="hidden sm:inline">
          Launch offer: {EARLY_ADOPTER_DISCOUNT_PERCENT}% off Standard and Pro,
          locked in for as long as you stay.
        </span>
        <Link
          href="/pricing"
          className="shrink-0 font-semibold underline underline-offset-4 hover:no-underline"
        >
          See pricing
        </Link>
      </div>
    </div>
  );
}
