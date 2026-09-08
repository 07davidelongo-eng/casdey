import { requireAdmin } from "@/lib/admin";
import {
  churnSummary,
  guaranteeSummary,
  mrr,
  planBreakdown,
  signupTrend,
} from "@/lib/admin-stats";
import { checkoutFunnel, visitorTrend } from "@/lib/posthog-query";
import { formatMoney } from "@/lib/money";
import { Funnel, LineChart, Split } from "@/components/app/chart";
import { Card, CardTitle, PageHeader, Stat } from "@/components/app/ui";

export const metadata = { title: "Business overview" };

/**
 * casdey's own Shopify-style admin page: the numbers a founder checks, not a
 * gym owner. See src/lib/admin-stats.ts for what each figure is sourced from
 * and why, and src/lib/posthog-query.ts for the visitor/checkout half, added
 * once PostHog EU (cookieless) was wired in on 2026-09-08.
 *
 * visitors/checkout are the two figures nothing in casdey's own tables can
 * answer, so they come back `null` rather than a fake zero whenever PostHog
 * is not configured or unreachable — the page says so explicitly instead of
 * drawing a chart or a conversion rate that looks real but is not.
 */
export default async function AdminPage() {
  await requireAdmin();

  const [plans, revenue, signups, churn, guarantee, visitors, checkout] =
    await Promise.all([
      planBreakdown(),
      mrr(),
      signupTrend(),
      churnSummary(),
      guaranteeSummary(),
      visitorTrend(),
      checkoutFunnel(),
    ]);

  const payingGyms = plans.counts.standard + plans.counts.pro;
  const guaranteeRefunded =
    guarantee.refundedByCurrency.eur > 0 || guarantee.refundedByCurrency.gbp > 0
      ? [
          guarantee.refundedByCurrency.eur > 0
            ? formatMoney(guarantee.refundedByCurrency.eur, "eur")
            : null,
          guarantee.refundedByCurrency.gbp > 0
            ? formatMoney(guarantee.refundedByCurrency.gbp, "gbp")
            : null,
        ]
          .filter(Boolean)
          .join(" + ")
      : "£0 / €0";

  return (
    <>
      <PageHeader
        eyebrow="casdey HQ"
        title="Business overview"
        lede="Every gym, not one. Money is read straight from Stripe; everything else is counted from casdey's own tables, the same rule the per-gym dashboard follows."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gyms, total" value={plans.total} hint={`${payingGyms} paying`} />
        <Stat
          label="MRR"
          value={formatMoney(revenue.eur, "eur")}
          hint={revenue.gbp > 0 ? `+ ${formatMoney(revenue.gbp, "gbp")}` : "No GBP subscriptions yet"}
          tone="teal"
        />
        <Stat
          label="Cancelled, last 12 weeks"
          value={churn.current}
          hint={
            churn.previous === 0
              ? "None in the 12 weeks before"
              : `${churn.previous} in the 12 weeks before`
          }
        />
        <Stat
          label="Guarantee claims"
          value={guarantee.totalClaims}
          hint={`${guarantee.pendingClaims} pending · ${guaranteeRefunded} refunded`}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {visitors ? (
          <LineChart
            title="Visitors"
            hero={String(visitors.totalCurrent)}
            changePercent={visitors.changePercent}
            tone="returned"
            points={visitors.current.map((week) => ({
              label: week.label,
              value: week.visitors,
              display: String(week.visitors),
            }))}
            comparison={visitors.previous.map((week) => ({ value: week.visitors }))}
          />
        ) : (
          <Card>
            <CardTitle>Visitors</CardTitle>
            <p className="mt-2 text-[0.8125rem] text-stone">
              Not connected. Set NEXT_PUBLIC_POSTHOG_HOST, POSTHOG_PROJECT_ID
              and POSTHOG_PERSONAL_API_KEY, or check that PostHog is reachable.
            </p>
          </Card>
        )}
        <LineChart
          title="Waitlist signups"
          hero={String(signups.totals.waitlist)}
          changePercent={signups.changeWaitlist}
          tone="amber"
          points={signups.current.map((week) => ({
            label: week.label,
            value: week.waitlist,
            display: String(week.waitlist),
          }))}
          comparison={signups.previous.map((week) => ({ value: week.waitlist }))}
        />
        <LineChart
          title="Gym signups"
          hero={String(signups.totals.gyms)}
          changePercent={signups.changeGyms}
          tone="teal"
          points={signups.current.map((week) => ({
            label: week.label,
            value: week.gyms,
            display: String(week.gyms),
          }))}
          comparison={signups.previous.map((week) => ({ value: week.gyms }))}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Plan mix</CardTitle>
          <div className="mt-4">
            <Split
              total={plans.total}
              parts={[
                { label: "Pro", value: plans.counts.pro, tone: "teal" },
                { label: "Standard", value: plans.counts.standard, tone: "amber" },
                { label: "Free week (trial)", value: plans.counts.trial, tone: "returned" },
                { label: "Free", value: plans.counts.free, tone: "quiet" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardTitle>The funnel</CardTitle>
          <p className="mt-1 text-[0.8125rem] text-stone">
            {visitors
              ? "Visitors are an anonymous cookieless count, so a visitor cannot be traced into a later signup one-for-one. Checkout started/completed can: both are captured server-side against the same gym."
              : "Visitors need PostHog connected (see the card above) to appear here."}
          </p>
          <div className="mt-4">
            <Funnel
              stages={[
                ...(visitors
                  ? [
                      {
                        label: "Visitors",
                        value: visitors.totalCurrent,
                        hint: "Last 12 weeks",
                        tone: "returned" as const,
                      },
                    ]
                  : []),
                {
                  label: "Waitlist joins",
                  value: signups.totals.waitlist,
                  hint: "Last 12 weeks",
                  tone: "amber",
                },
                {
                  label: "Gyms signed up",
                  value: signups.totals.gyms,
                  hint: "Last 12 weeks",
                  tone: "returned",
                },
                ...(checkout
                  ? [
                      {
                        label: "Checkout started",
                        value: checkout.started,
                        hint: "Last 12 weeks",
                        tone: "amber" as const,
                      },
                      {
                        label: "Checkout completed",
                        value: checkout.completed,
                        hint: "Last 12 weeks",
                        tone: "teal" as const,
                      },
                    ]
                  : []),
                {
                  label: "Gyms paying",
                  value: payingGyms,
                  hint: "Right now",
                  tone: "teal",
                },
              ]}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
