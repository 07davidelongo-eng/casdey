import Link from "next/link";

import type { Practice } from "@/lib/types";

/**
 * Says where the account stands, and only when that is worth a row of screen.
 * An account in good standing gets no banner at all.
 *
 * Tone rule from the brand guide: state the position, offer the fix, get out of
 * the way. No urgency theatre on a billing message.
 */

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function BillingBanner({ practice }: { practice: Practice }) {
  const { subscription_status: status } = practice;

  if (status === "active") return null;

  if (status === "trialing") {
    const left = daysUntil(practice.trial_ends_at);
    // Quiet for most of the week, then worth saying.
    if (left === null || left > 3) return null;
    return (
      <Banner tone="info">
        <span>
          Your free week ends in{" "}
          <span className="literal font-medium">
            {left} {left === 1 ? "day" : "days"}
          </span>
          . Your card is on file, so nothing breaks.
        </span>
        <BannerLink href="/app/settings/billing">Billing</BannerLink>
      </Banner>
    );
  }

  if (status === "past_due") {
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

  if (status === "canceled" || status === "incomplete" || status === "none") {
    return (
      <Banner tone="warn">
        <span>
          {status === "none"
            ? "Start your free week to import patients and send."
            : "This account is not active. Your data is here, sending is off."}
        </span>
        <BannerLink href="/app/settings/billing">
          {status === "none" ? "Start free week" : "Reactivate"}
        </BannerLink>
      </Banner>
    );
  }

  return null;
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
