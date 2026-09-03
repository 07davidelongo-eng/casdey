import Link from "next/link";

import type { Gym } from "@/lib/types";
import { effectivePlan, isPaidPlan, trialDaysLeft } from "@/lib/plan";

/**
 * A one-line status strip, shown only when there is something worth saying. A
 * gym comfortably inside its free week, or paid up on a plan, gets no banner
 * at all.
 *
 * Tone rule from the brand guide: state the position, offer the fix, get out of
 * the way. No urgency theatre.
 */
export function BillingBanner({ gym }: { gym: Gym }) {
  const plan = effectivePlan(gym);

  if (plan === "trial") {
    const left = trialDaysLeft(gym);
    // Quiet for most of the week, then a gentle nudge near the end.
    if (left === null || left > 3) return null;
    return (
      <Banner tone="info">
        <span>
          Your free week ends in{" "}
          <span className="literal font-medium">
            {left} {left === 1 ? "day" : "days"}
          </span>
          . After that you keep everything except sending, unless you pick a
          plan.
        </span>
        <BannerLink href="/app/settings/billing">See plans</BannerLink>
      </Banner>
    );
  }

  if (isPaidPlan(plan)) {
    if (gym.subscription_status !== "past_due") return null;
    return (
      <Banner tone="warn">
        <span>
          The last payment did not go through. Sending is paused until the card
          is updated.
        </span>
        <BannerLink href="/app/settings/billing">Update card</BannerLink>
      </Banner>
    );
  }

  // Free.
  return (
    <Banner tone="info">
      <span>
        You are on the Free plan. Import and see who is lapsed as much as you
        like. Sending needs a paid plan.
      </span>
      <BannerLink href="/app/settings/billing">See plans</BannerLink>
    </Banner>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "info" | "warn";
  children: React.ReactNode;
}) {
  const surface =
    tone === "info"
      ? "bg-shallow border-b-[color-mix(in_srgb,var(--teal)_20%,transparent)] text-[color-mix(in_srgb,var(--teal)_80%,var(--ink))]"
      : "bg-[color-mix(in_srgb,var(--amber)_13%,var(--paper))] border-b-[color-mix(in_srgb,var(--amber)_38%,transparent)] text-[color-mix(in_srgb,var(--amber)_50%,var(--ink))]";

  return (
    <div className={`border-b ${surface}`}>
      <div className="mx-auto flex w-full max-w-[68rem] flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-[0.875rem] sm:px-8">
        {children}
      </div>
    </div>
  );
}

function BannerLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-semibold underline underline-offset-4 hover:no-underline"
    >
      {children}
    </Link>
  );
}
