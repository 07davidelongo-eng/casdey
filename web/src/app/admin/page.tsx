import { requireAdmin } from "@/lib/admin";
import {
  churnSummary,
  guaranteeSummary,
  mrr,
  planBreakdown,
  signupTrend,
} from "@/lib/admin-stats";
import { formatMoney } from "@/lib/money";
import { Funnel, LineChart, Split } from "@/components/app/chart";
import { Card, CardTitle, PageHeader, Stat } from "@/components/app/ui";

export const metadata = { title: "Business overview" };

/**
 * casdey's own Shopify-style admin page: the numbers a founder checks, not a
 * gym owner. See src/lib/admin-stats.ts for what each figure is sourced from
 * and why.
 *
 * What is missing on purpose: visitors, and how many of them reached
 * checkout. Nothing in casdey's own tables can answer that, it needs an
 * actual analytics tool wired into the marketing site and the checkout flow
 * (PostHog EU, cookieless, planned 2026-09-08). This page is built so that
 * half slots in as its own card once that lands, without reshaping the rest.
 */
export default async function AdminPage() {
  await requireAdmin();

  const [plans, revenue, signups, churn, guarantee] = await Promise.all([
    planBreakdown(),
    mrr(),
    signupTrend(),
    churnSummary(),
    guaranteeSummary(),
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

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          <CardTitle>The funnel casdey can see today</CardTitle>
          <p className="mt-1 text-[0.8125rem] text-stone">
            Visitors and checkout starts are not in this list, they need an
            analytics tool, not a table casdey already has.
          </p>
          <div className="mt-4">
            <Funnel
              stages={[
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
