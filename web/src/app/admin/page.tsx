import { requireAdmin } from "@/lib/admin";
import { paidTrialEnabled } from "@/lib/plan";
import {
  activationFunnel,
  churnSummary,
  feedbackSummary,
  guaranteeSummary,
  gymSignupTrend,
  mrr,
  nonInternalGymIds,
  planBreakdown,
  productReach,
  revenueCollected,
  subscriptionHealth,
  testAndDev,
  trialSummary,
  type MoneyByCurrency,
} from "@/lib/admin-stats";
import {
  checkoutFunnel,
  deviceMix,
  posthogConfigured,
  topCountries,
  topPages,
  topReferrers,
  visitorTrend,
} from "@/lib/posthog-query";
import { formatMoney } from "@/lib/money";
import { Funnel, LineChart, Split } from "@/components/app/chart";
import {
  ButtonLink,
  Card,
  CardTitle,
  PageHeader,
  Stat,
  formatDate,
} from "@/components/app/ui";
import { PeriodNav, RankedList, Section, periodFrom } from "./parts";

export const metadata = { title: "Business overview" };

/**
 * The /check-up report: a separate, broader snapshot (marketing + these same
 * numbers + engineering + casdey-hq.md), published as a Claude Artifact and
 * kept up to date in place by the /check-up skill and its weekly routine —
 * see .claude/skills/check-up/SKILL.md "Artifact URL". Linked out to, not
 * embedded: it is Davide's own private artifact, opened in his own
 * claude.ai session, not something casdey's server can fetch or render.
 */
const CHECK_UP_URL =
  "https://claude.ai/code/artifact/e527486a-6a23-4267-8d4e-f9722adbdbbe";

/**
 * casdey's own Shopify/Baremetrics-style founder view: the numbers a founder
 * checks, not a gym owner.
 *
 *   - Money is read live from Stripe (MRR) and from subscription_payments
 *     (cash collected), never re-derived from a price catalogue — see
 *     src/lib/admin-stats.ts for why.
 *   - Signups, plan mix, churn, activation and product output are counted
 *     straight from casdey's own tables.
 *   - Visitors and the marketing funnel come from PostHog EU (cookieless) via
 *     src/lib/posthog-query.ts, and come back null (never a fake zero) when
 *     PostHog is unreachable — the page then says so rather than drawing a
 *     conversion rate that looks real but is not.
 *
 * Every figure excludes gyms.is_internal (migrations 0035 + 0036): casdey's
 * own dev/QA gyms share the table with real customers because local dev points
 * at the production Supabase project. The one "Test & dev" section at the
 * bottom is the deliberate exception — it reports exactly those gyms, so it is
 * obvious whether test data is leaking into the business numbers.
 *
 * The period is a whole number of days (see src/app/admin/parts.tsx for the
 * URL → days mapping); the trend charts group by day for short windows and by
 * week beyond ~3 weeks. The waitlist was dropped from this page on 2026-09-08:
 * casdey.com is published, so the waitlist is no longer a live acquisition
 * channel. The waitlist_signups table still exists and the /waitlist form
 * still writes to it; it just is not a founder metric any more.
 */
export default async function AdminPage(props: PageProps<"/admin">) {
  await requireAdmin();

  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const period = periodFrom({
    range: one(sp.range),
    count: one(sp.count),
    unit: one(sp.unit),
  });
  const { days, bucket } = period;
  const periodSentence = period.sentence;

  const gymIds = await nonInternalGymIds();

  const [
    plans,
    revenue,
    collected,
    signups,
    churn,
    guarantee,
    health,
    activation,
    reach,
    feedback,
    testDev,
    visitors,
    checkout,
    pages,
    referrers,
    countries,
    devices,
    trials,
  ] = await Promise.all([
    planBreakdown(),
    mrr(),
    revenueCollected(gymIds, days),
    gymSignupTrend(days, bucket),
    churnSummary(days),
    guaranteeSummary(),
    subscriptionHealth(),
    activationFunnel(gymIds),
    productReach(gymIds, days),
    feedbackSummary(gymIds, days),
    testAndDev(),
    visitorTrend(days, bucket),
    checkoutFunnel(days),
    topPages(days),
    topReferrers(days),
    topCountries(days),
    deviceMix(days),
    trialSummary(gymIds),
  ]);

  const posthogOn = posthogConfigured();

  const money = (by: MoneyByCurrency, zero = "€0"): string => {
    const parts: string[] = [];
    if (by.eur > 0) parts.push(formatMoney(by.eur, "eur"));
    if (by.gbp > 0) parts.push(formatMoney(by.gbp, "gbp"));
    return parts.length > 0 ? parts.join(" + ") : zero;
  };

  const priorCount = (previous: number): string =>
    previous === 0 ? "none in the period before" : `${previous} the period before`;

  const arrEur = revenue.byCurrency.eur * 12;
  const arrGbp = revenue.byCurrency.gbp * 12;
  const arpaEur =
    revenue.gymsByCurrency.eur > 0
      ? Math.round(revenue.byCurrency.eur / revenue.gymsByCurrency.eur)
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="casdey HQ"
        title="Business overview"
        lede="Every gym, not one. Money is read straight from Stripe; signups, activation and product output are counted from casdey's own tables; visitors come from PostHog. Nothing here is a summary table that can drift."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink
              href={CHECK_UP_URL}
              target="_blank"
              rel="noopener noreferrer"
              variant="quiet"
            >
              Check-up report ↗
            </ButtonLink>
            <PeriodNav current={period} />
          </div>
        }
      />

      {/* Headline */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="MRR"
          value={money(revenue.byCurrency)}
          hint={
            revenue.payingGyms > 0
              ? `${revenue.payingGyms} paying · ARR ${money({ eur: arrEur, gbp: arrGbp })}`
              : "No paying gyms yet"
          }
          tone="teal"
        />
        <Stat
          label="Gyms"
          value={plans.total}
          hint={`${signups.total} new this period · ${activation.paying} paying`}
        />
        <Stat
          label="Cash collected, period"
          value={money(collected.windowNet)}
          hint={`net of refunds · ${money(collected.previousNet)} before`}
        />
        <Stat
          label="Cancelled, period"
          value={churn.current}
          hint={priorCount(churn.previous)}
        />
      </div>

      {/* -------------------------------------------------- Traffic */}
      <Section
        title="Traffic"
        sub={
          posthogOn
            ? `Cookieless, so a count of hashes rather than people. ${periodSentence}`
            : undefined
        }
      >
        {!posthogOn ? (
          <Card>
            <CardTitle>PostHog not connected</CardTitle>
            <p className="mt-2 text-[0.8125rem] text-stone">
              Set NEXT_PUBLIC_POSTHOG_HOST, POSTHOG_PROJECT_ID and
              POSTHOG_PERSONAL_API_KEY, or check that PostHog is reachable.
              Every figure in this section stays blank until it is.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {visitors ? (
                <>
                  <LineChart
                    title="Visitors"
                    hero={visitors.totalCurrent.toLocaleString("en-GB")}
                    changePercent={visitors.changePercent}
                    tone="returned"
                    periodLabel={period.label}
                    points={visitors.current.map((week) => ({
                      label: week.label,
                      value: week.visitors,
                      display: String(week.visitors),
                    }))}
                    comparison={visitors.previous.map((week) => ({
                      value: week.visitors,
                    }))}
                  />
                  <LineChart
                    title="Pageviews"
                    hero={visitors.viewsCurrent.toLocaleString("en-GB")}
                    changePercent={visitors.viewsChangePercent}
                    tone="teal"
                    periodLabel={period.label}
                    points={visitors.current.map((week) => ({
                      label: week.label,
                      value: week.views,
                      display: String(week.views),
                    }))}
                    comparison={visitors.previous.map((week) => ({
                      value: week.views,
                    }))}
                  />
                </>
              ) : (
                <Card>
                  <CardTitle>Visitors</CardTitle>
                  <p className="mt-2 text-[0.8125rem] text-stone">
                    PostHog is configured but the query did not come back. It is
                    usually transient; reload in a minute.
                  </p>
                </Card>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <RankedList
                title="Top pages"
                rows={pages}
                empty="No pageviews in this period."
                unit="views"
              />
              <RankedList
                title="Referrers"
                rows={referrers}
                empty="No referred visits in this period."
              />
              <RankedList
                title="Countries"
                rows={countries}
                empty="No located visitors in this period."
              />
              <RankedList
                title="Devices"
                rows={devices}
                empty="No visitors in this period."
              />
            </div>
          </>
        )}
      </Section>

      {/* -------------------------------------------------- Acquisition */}
      <Section
        title="Acquisition funnel"
        sub={`From a first visit through to a paying gym. ${periodSentence}`}
      >
        <Card>
          <p className="mb-4 text-[0.8125rem] text-stone">
            {posthogOn && visitors
              ? "Visitors are an anonymous cookieless count, so one cannot be traced into a later signup. Checkout started and completed are captured server-side against the same gym id, so that pair is exact."
              : "Connect PostHog to see the visitor and checkout stages; signups and paying come from casdey's own tables regardless."}
          </p>
          <Funnel
            stages={[
              ...(posthogOn && visitors
                ? [
                    {
                      label: "Visitors",
                      value: visitors.totalCurrent,
                      hint: `Last ${period.label}`,
                      tone: "returned" as const,
                    },
                  ]
                : []),
              {
                label: "Gyms signed up",
                value: signups.total,
                hint: `Last ${period.label}`,
                tone: "amber",
              },
              {
                label: "Reached first campaign",
                value: activation.approvedCampaign,
                hint: "All time, all gyms",
                tone: "returned",
              },
              ...(checkout
                ? [
                    {
                      label: "Checkout started",
                      value: checkout.started,
                      hint: `Last ${period.label}`,
                      tone: "amber" as const,
                    },
                    {
                      label: "Checkout completed",
                      value: checkout.completed,
                      hint: `Last ${period.label}`,
                      tone: "teal" as const,
                    },
                  ]
                : []),
              {
                label: "Gyms paying",
                value: activation.paying,
                hint: "Right now",
                tone: "teal",
              },
            ]}
          />
          {checkout && checkout.startedByTier.length > 0 ? (
            <p className="mt-4 text-[0.8125rem] text-stone">
              Checkouts started by tier:{" "}
              {checkout.startedByTier
                .map((row) => `${row.label} ${row.value}`)
                .join(" · ")}
              .
            </p>
          ) : null}
        </Card>
      </Section>

      {/* -------------------------------------------------- Activation */}
      <Section
        title="Activation"
        sub="How far each gym has got through first-run setup. Counts are independent — a gym that priced a service before importing shows in both."
      >
        <Card>
          <Funnel
            stages={[
              {
                label: "Signed up",
                value: activation.signedUp,
                hint: "Real gyms",
                tone: "amber",
              },
              {
                label: "Imported members",
                value: activation.importedMembers,
                hint: "Has at least one member",
                tone: "returned",
              },
              {
                label: "Priced a service",
                value: activation.pricedService,
                hint: "Revenue estimate can work",
                tone: "returned",
              },
              {
                label: "Chose an offer",
                value: activation.choseOffer,
                hint: "Win-back wording set",
                tone: "returned",
              },
              {
                label: "Approved a campaign",
                value: activation.approvedCampaign,
                hint: "Actually sent something",
                tone: "teal",
              },
              {
                label: "Paying",
                value: activation.paying,
                hint: "On Standard or Pro",
                tone: "teal",
              },
            ]}
          />
        </Card>
      </Section>

      {/* -------------------------------------------------- Revenue */}
      <Section title="Revenue" sub="MRR is live from Stripe; cash collected is from the invoice.paid webhook's own record. Split by currency, never blended.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="MRR (EUR)"
            value={formatMoney(revenue.byCurrency.eur, "eur")}
            hint={
              revenue.byCurrency.gbp > 0
                ? `+ ${formatMoney(revenue.byCurrency.gbp, "gbp")} GBP`
                : "No GBP subscriptions"
            }
            tone="teal"
          />
          <Stat label="ARR (EUR)" value={formatMoney(arrEur, "eur")} hint="MRR × 12" />
          <Stat
            label="ARPA"
            value={arpaEur > 0 ? formatMoney(arpaEur, "eur") : "—"}
            hint="Per paying gym, EUR"
          />
          <Stat
            label="Collected, all time"
            value={money(collected.allTimeNet)}
            hint="Net of every refund"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Cash this period</CardTitle>
            <dl className="mt-4 space-y-3 text-[0.9375rem]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-graphite">Gross charged</dt>
                <dd className="literal font-medium text-ink">
                  {money(collected.windowGross)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-graphite">Refunded</dt>
                <dd className="literal font-medium text-ink">
                  {money(collected.windowRefunded, "—")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-ash pt-3">
                <dt className="text-ink">Net</dt>
                <dd className="literal font-medium text-teal">
                  {money(collected.windowNet)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-[0.8125rem] text-stone">
              {money(collected.previousNet)} net in the {period.label} before.
            </p>
          </Card>

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
        </div>
      </Section>

      {/* -------------------------------------------------- Subscriptions */}
      <Section
        title="Subscriptions & retention"
        sub="Where every gym's subscription actually stands, and how the trial is converting."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>By status</CardTitle>
            <div className="mt-4">
              <Split
                total={plans.total}
                parts={[
                  { label: "Paying", value: health.statusCounts.active, tone: "teal" },
                  { label: "Free week", value: health.statusCounts.trial, tone: "returned" },
                  { label: "Awaiting payment", value: health.statusCounts.pastDue, tone: "amber" },
                  { label: "Free", value: health.statusCounts.free, tone: "quiet" },
                  { label: "Cancelled", value: health.statusCounts.canceled, tone: "quiet" },
                ]}
              />
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Trial → paid"
              value={
                health.trialConversionRate === null
                  ? "—"
                  : `${health.trialConversionRate}%`
              }
              hint={`${health.trialsConverted}/${health.trialsEverStarted} trials`}
            />
            <Stat
              label="Trials ending ≤7d"
              value={health.trialsEndingSoon}
              hint="Free week almost up"
            />
            <Stat
              label="Scheduled cancels"
              value={health.scheduledCancellations}
              hint="Still inside the paid period"
              tone={health.scheduledCancellations > 0 ? "returned" : "default"}
            />
            <Stat
              label="Awaiting payment"
              value={health.statusCounts.pastDue}
              hint="Failing, or waiting on the bank"
              tone={health.statusCounts.pastDue > 0 ? "returned" : "default"}
            />
          </div>
        </div>

        <div className="mt-6">
          <Card>
            <CardTitle>Profit-or-nothing guarantee</CardTitle>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Claims, all time" value={guarantee.totalClaims} />
              <Stat label="Pending" value={guarantee.pendingClaims} />
              <Stat
                label="Refunded"
                value={money(guarantee.refundedByCurrency, "€0")}
              />
              <Stat
                label="Cancelled, period"
                value={churn.current}
                hint={priorCount(churn.previous)}
              />
            </div>
          </Card>
        </div>
      </Section>

      {/* -------------------------------------------------- Product reach */}
      <Section
        title="Product reach"
        sub={`What casdey actually did across every gym. ${periodSentence}`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Members under management"
            value={reach.membersManaged.toLocaleString("en-GB")}
            hint="Across every gym, right now"
          />
          <Stat
            label="Members returned"
            value={reach.membersReturned.current}
            hint={priorCount(reach.membersReturned.previous)}
            tone="teal"
          />
          <Stat
            label="Revenue recovered"
            value={money(reach.revenueRecovered.current, "€0")}
            hint={`${money(reach.revenueRecovered.previous, "€0")} before`}
            tone="teal"
          />
          <Stat
            label="Campaigns approved"
            value={reach.campaignsApproved.current}
            hint={priorCount(reach.campaignsApproved.previous)}
          />
          <Stat
            label="Messages sent"
            value={reach.messagesSent.current.toLocaleString("en-GB")}
            hint={priorCount(reach.messagesSent.previous)}
          />
          <Stat
            label="Bookings"
            value={reach.bookings.current}
            hint={priorCount(reach.bookings.previous)}
          />
        </div>
      </Section>

      {/* -------------------------------------------------- Feedback */}
      <Section
        title="What gyms are telling us"
        sub={`In-app feedback. ${feedback.total} all time · ${feedback.recentCount} this period.`}
      >
        <Card>
          {feedback.latest.length === 0 ? (
            <p className="text-[0.8125rem] text-stone">
              No feedback yet. The in-app box writes here and emails
              davide@casdey.com at the same time.
            </p>
          ) : (
            <ul className="divide-y divide-ash">
              {feedback.latest.map((note, index) => (
                <li key={`${note.createdAt}-${index}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-[0.8125rem] text-stone">
                    <span className="font-medium text-graphite">{note.gymName}</span>
                    <span>
                      {note.path ? <span className="literal">{note.path}</span> : null}
                      {note.path ? " · " : ""}
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.9375rem] text-ink">
                    {note.message.length > 280
                      ? `${note.message.slice(0, 280)}…`
                      : note.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      {/* -------------------------------------------------- Trials */}
      {paidTrialEnabled() ? (
        <Section
          title="Paid weeks"
          sub={`${trials.running.length} running · ${trials.converted} converted · ${trials.cancelled} cancelled.`}
        >
          <Card className="mb-4">
            {trials.running.length === 0 ? (
              <p className="text-[0.8125rem] text-stone">
                No paid weeks running.
              </p>
            ) : (
              <ul className="divide-y divide-ash">
                {trials.running.map((trial) => (
                  <li
                    key={trial.gymId}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-[0.9375rem] font-medium text-ink">
                      {trial.gymName}
                      {trial.committed ? (
                        <span className="ml-2 text-[0.75rem] text-stone">
                          committed
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[0.8125rem] text-stone">
                      {trial.cancelled
                        ? "cancelled, owes nothing"
                        : trial.outstanding.length === 0
                          ? "set up, converts at day 7"
                          : `outstanding: ${trial.outstanding.join(", ")}`}
                      {" · "}
                      <span className="literal">
                        {trial.daysLeft == null
                          ? "week over"
                          : `${trial.daysLeft}d left`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </Section>
      ) : null}

      {/* -------------------------------------------------- Test & dev */}
      <Section
        title="Test & dev"
        sub="casdey's own dev/QA gyms (gyms.is_internal). Walled off from every number above — kept here only so it is obvious whether test data is leaking into the real figures. It leaked once: a £120 fixture booking, fixed by migration 0036."
      >
        <Card className="opacity-90">
          {testDev.gymCount === 0 ? (
            <p className="text-[0.8125rem] text-stone">
              No internal gyms flagged.
            </p>
          ) : (
            <>
              <p className="text-[0.8125rem] text-stone">
                {testDev.gymCount} gym{testDev.gymCount === 1 ? "" : "s"}:{" "}
                {testDev.gymNames.join(", ")}.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Members" value={testDev.members.toLocaleString("en-GB")} />
                <Stat label="Campaigns approved" value={testDev.campaignsApproved} />
                <Stat
                  label="Messages sent"
                  value={testDev.messagesSent.toLocaleString("en-GB")}
                />
                <Stat label="Bookings" value={testDev.bookings} />
              </div>
            </>
          )}
        </Card>
      </Section>
    </>
  );
}
