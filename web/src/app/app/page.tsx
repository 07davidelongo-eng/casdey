import Link from "next/link";

import { requireGym } from "@/lib/dal";
import { gymStats } from "@/lib/stats";
import { hasPricedServices, recoveredRevenue } from "@/lib/revenue";
import { lapsedOpportunity } from "@/lib/opportunity";
import {
  atRiskRuleFor,
  describeRule,
  hasChosenLapseRule,
  monthsSince,
  ruleFor,
} from "@/lib/lapse";
import { formatMoney, gymCurrency } from "@/lib/money";
import { buildSetupState } from "@/lib/setup";
import { paidTrialEnabled } from "@/lib/plan";
import { activationFor } from "@/lib/trial";
import { activityWithComparison, change } from "@/lib/dashboard";
import { Funnel, LineChart, MetricChart, Split } from "@/components/app/chart";
import { calendarConnectionView } from "@/lib/calendar/provider";
import { isGoogleCalendarConfigured } from "@/lib/calendar/google";
import { isCalendarKeyConfigured } from "@/lib/calendar/tokens";
import { isSendingConfigured } from "@/lib/email/domains";
import { MemberTimeline } from "@/components/app/member-timeline";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { TrialPanel } from "@/components/app/trial-panel";
import {
  ButtonLink,
  Card,
  CardTitle,
  Notice,
  PageHeader,
  Stat,
  formatDate,
  memberName,
} from "@/components/app/ui";
import type { Member } from "@/lib/types";

export const metadata = { title: "Overview" };

/**
 * How far back the dashboard looks (#69).
 *
 * Weeks throughout, because the underlying series is weekly: a gym sends in
 * bursts and a daily chart of a 50-a-day cap is mostly zeroes. Every range is
 * drawn against the same length of time immediately before it, so the
 * comparison line always means the same thing.
 *
 * Fifty-two is the longest offered. Beyond a year the comparison would reach
 * back further than casdey has existed for any gym, and a chart whose second
 * line is all zeroes says nothing.
 */
const RANGES = [
  { weeks: 4, short: "4w", label: "four weeks", heading: "The last four weeks" },
  {
    weeks: 12,
    short: "12w",
    label: "twelve weeks",
    heading: "The last twelve weeks",
  },
  {
    weeks: 26,
    short: "6m",
    label: "six months",
    heading: "The last six months",
  },
  { weeks: 52, short: "1y", label: "year", heading: "The last year" },
] as const;

export default async function DashboardPage(props: PageProps<"/app">) {
  const params = await props.searchParams;
  const { gym, session } = await requireGym();

  const rule = ruleFor(gym);
  // How far back the charts look. A URL rather than component state, so a
  // range can be linked to and survives a reload, and so the whole page is
  // still one server render.
  const range = RANGES.find((r) => String(r.weeks) === params.range) ?? RANGES[1];

  // One wave, not five. Every read below needs only the gym id and the range,
  // both known here, so they fire together: a stack of round trips to a
  // database in another region becomes a single wait. Order of the tuple
  // matches the array below.
  //   - recovered revenue + whether services are priced
  //   - the dashboard counts
  //   - twelve weeks of activity and the twelve before, to compare (#48, #61)
  //   - approved-campaign count + calendar connection, for the setup checklist
  //   - the most recent return, the one thing this page exists to show
  const [
    [recovered, priced],
    stats,
    { weeks, total: totals, previous, previousWeeks },
    [{ count: approvedCampaigns }, calendar],
    { data: returnedRows },
  ] = await Promise.all([
    Promise.all([
      recoveredRevenue(session.supabase, gym.id),
      hasPricedServices(session.supabase, gym.id),
    ]),
    gymStats(session.supabase, gym.id, rule, atRiskRuleFor(gym)),
    activityWithComparison(gym.id, range.weeks),
    Promise.all([
      session.supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", gym.id)
        .not("approved_at", "is", null),
      calendarConnectionView(gym.id),
    ]),
    session.supabase
      .from("members")
      .select("*")
      .eq("gym_id", gym.id)
      .eq("is_test", false)
      .eq("status", "returned")
      .order("returned_at", { ascending: false })
      .limit(1),
  ]);

  // The first-run checklist. Derived from state the gym already has, so it
  // ticks itself off and disappears once setup is done, no flag to persist.
  const setup = buildSetupState({
    memberCount: stats.members,
    servicesPriced: priced,
    ruleDescription: describeRule(ruleFor(gym)),
    lapseRuleChosen: hasChosenLapseRule(gym),
    offerChosen: Boolean(gym.offer_text),
    sendingConfigured: isSendingConfigured(),
    // Only verified counts. A domain sitting pending sends nothing from the
    // gym's own address, so calling the step done would be a lie the gym only
    // finds out about by reading their own headers.
    sendingVerified: gym.sending_domain_status === "verified",
    calendarConfigured:
      isGoogleCalendarConfigured() && isCalendarKeyConfigured(),
    calendarConnected: calendar.connected,
    hasApprovedCampaign: (approvedCampaigns ?? 0) > 0,
  });

  const returned = (returnedRows?.[0] ?? null) as Member | null;

  // Forward-looking: roughly what the lapsed members are worth per month, taken
  // from the gym's own membership prices. Needs the lapsed count from the batch
  // above, so it is the one read that cannot join it. An estimate, shown as
  // one, and it never feeds the guarantee. See src/lib/opportunity.ts.
  const opportunity = await lapsedOpportunity(
    session.supabase,
    gym.id,
    stats.lapsed,
  );

  const currency = gymCurrency(gym);

  // Trial With Penalty (Track H). The evidence is exactly what the setup
  // checklist above already read, so this costs no extra queries.
  const trialSteps = activationFor(gym, {
    hasMembers: stats.members > 0,
    hasPricedServices: priced,
    hasApprovedCampaign: (approvedCampaigns ?? 0) > 0,
  });
  const trialPanel = paidTrialEnabled() ? (
    <TrialPanel gym={gym} steps={trialSteps} />
  ) : null;

  if (stats.members === 0) {
    return (
      <>
        <PageHeader eyebrow="Overview" title={gym.name} />
        {params.welcome ? (
          <div className="mb-6">
            <Notice>
              {paidTrialEnabled()
                ? "Your free week has started, everything unlocked. Work through the steps below to see it go, and there is nothing more to pay once they are done."
                : "Your free week has started, everything unlocked and no card taken. Work through the steps below to see it go."}
            </Notice>
          </div>
        ) : null}
        {trialPanel ? <div className="mb-6">{trialPanel}</div> : null}
        <SetupChecklist state={setup} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={gym.name}
        lede={`Lapsed means ${describeRule(ruleFor(gym))}. Change that in settings.`}
        actions={
          <ButtonLink href="/app/campaigns/new">Build a campaign</ButtonLink>
        }
      />

      {/* Nothing links here any more (signup lands on ?welcome=1), so this is
          unreachable rather than wrong on screen. Kept because a stale query
          string in somebody's history should not greet them with a claim about
          their bill: under Trial With Penalty €1 IS taken at signup, which is
          what the old wording denied. */}
      {params.started ? (
        <div className="mb-6">
          <Notice>
            Your free week has started, with every feature unlocked.
          </Notice>
        </div>
      ) : null}

      {/* A dead calendar connection has to be said HERE, not only on the
          settings page that turned it on. Google's refresh token dies for
          ordinary reasons (the gym revoked access, changed their password,
          left the account idle), and from that moment every member who opens
          a booking link is told casdey cannot show them any times, while the
          gym sees nothing wrong: booking is an optional setup step, so the
          checklist that would have re-raised it stays hidden, and Settings →
          Booking is a page an owner visits once. Found live on a real gym
          whose booking had been silently dead. The view is already loaded
          above for the checklist, so saying it costs nothing. */}
      {calendar.needsReauth ? (
        <div className="mb-6">
          <Notice tone="warn">
            Your Google Calendar has disconnected, so casdey is not offering
            members any booking times. It will not book over something already
            in your diary, so it stops rather than guesses.{" "}
            <Link
              href="/app/settings/booking"
              className="text-teal underline underline-offset-4"
            >
              Reconnect it
            </Link>{" "}
            to switch booking back on.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Members" value={stats.members} />
        <Stat
          label="At risk"
          value={stats.atRisk}
          hint={`no visit for ${gym.at_risk_after_days}+ days`}
        />
        <Stat
          label="Gone quiet"
          value={stats.lapsed}
          tone="teal"
          hint={
            stats.reachable < stats.lapsed
              ? `${stats.reachable} have an email address`
              : "all reachable by email"
          }
        />
        <Stat
          label="Contacted"
          value={stats.contacted}
          hint="sent at least one message"
        />
        <Stat
          label="Returned"
          value={stats.returned}
          tone="returned"
          hint="came back after we wrote"
        />
      </div>

      {/* The forward figure, paired with Recovered below it: what the quiet
          half of the list is worth per month, against what casdey has pulled
          back so far. An estimate from the gym's own membership prices, shown
          on every tier (the size of the opportunity is never hidden) and
          deliberately set smaller than Recovered so it does not compete with
          the number the product is actually judged on. */}
      {opportunity.priced && opportunity.lapsedMembers > 0 ? (
        <Card className="mt-4">
          <p className="label text-stone">Recurring revenue lapsed</p>
          <p className="literal mt-2 text-[1.75rem] leading-none font-medium text-ink">
            {formatMoney(opportunity.monthlyMinor, currency)}
            <span className="text-[0.9375rem] font-normal text-stone">
              /month
            </span>
          </p>
          <p className="mt-3 max-w-xl text-[0.8125rem] text-stone">
            Your {opportunity.lapsedMembers} lapsed{" "}
            {opportunity.lapsedMembers === 1 ? "member" : "members"} represent
            about this much a month between them, at your typical membership of{" "}
            {formatMoney(opportunity.typicalMonthlyMinor, currency)}. A rough
            measure of the opportunity, not a promise, and some may already have
            cancelled with you.
          </p>
        </Card>
      ) : null}

      {/* Recovered revenue belongs with the counts above it, not at the bottom
          of the page: it is the one number the whole product is judged on and
          the first thing anybody opens this page to see. */}
      {priced ? (
        <Card className="mt-4">
          <p className="label text-stone">Revenue recovered</p>
          <p className="literal mt-2 text-[2.5rem] leading-none font-medium text-[color-mix(in_srgb,var(--amber)_62%,var(--ink))]">
            {formatMoney(recovered.totalMinor, currency)}
          </p>
          <p className="mt-3 max-w-xl text-[0.8125rem] text-stone">
            {recovered.bookings - recovered.unpriced}{" "}
            {recovered.bookings - recovered.unpriced === 1
              ? "booking"
              : "bookings"}{" "}
            casdey won back, each one at the price of the service it was for.
            Not an average, and not a number casdey has billed.
          </p>

          {/* What the money is made of. Thirty monthly memberships and thirty
              single sessions are the same total and completely different
              businesses. */}
          {recovered.recurringMinor > 0 || recovered.oneOffMinor > 0 ? (
            <div className="mt-4 border-t border-ash pt-4">
              <p className="text-[0.875rem] text-graphite">
                <span className="literal text-ink">
                  {formatMoney(recovered.recurringMinor, currency)}
                </span>{" "}
                of it is recurring and{" "}
                <span className="literal text-ink">
                  {formatMoney(recovered.oneOffMinor, currency)}
                </span>{" "}
                is one off.
              </p>
              {recovered.annualisedRecurringMinor > recovered.recurringMinor ? (
                <p className="mt-1 text-[0.8125rem] text-stone">
                  The recurring part is worth about{" "}
                  {formatMoney(recovered.annualisedRecurringMinor, currency)} over
                  a year if those members stay, which is the figure worth
                  holding against what casdey costs.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Said out loud rather than quietly depressing the total. A gym
              seeing a number lower than it expected deserves to know why. */}
          {recovered.unpriced > 0 ? (
            <p className="mt-3 text-[0.8125rem] text-stone">
              {recovered.unpriced}{" "}
              {recovered.unpriced === 1 ? "booking has" : "bookings have"} no
              service on{" "}
              {recovered.unpriced === 1 ? "it" : "them"}, so casdey cannot say
              what {recovered.unpriced === 1 ? "it was" : "they were"} worth and
              {recovered.unpriced === 1 ? " it is" : " they are"} left out of
              this total.
            </p>
          ) : null}
        </Card>
      ) : (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>See the money, not just the count</CardTitle>
            <p className="text-[0.9375rem] text-graphite">
              Add what you sell and what it costs. casdey then values every
              booking it wins back at the price of the service it was for, and
              those are the same prices your members read when they book.
            </p>
          </div>
          <ButtonLink href="/app/settings/services" variant="quiet">
            Add your services
          </ButtonLink>
        </Card>
      )}

      {/* Analytics. Each measure gets its own panel against its own scale:
          messages sent and members returned differ by an order of magnitude,
          and one chart with two y-axes would let the picture imply a
          relationship the data has not earned. */}
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="display text-[1.25rem]">{range.heading}</h2>
            <p className="text-[0.875rem] text-stone">
              {totals.sent === 0
                ? "Fills in as soon as your first campaign goes out."
                : `Compared with the ${range.label.toLowerCase()} before.`}
            </p>
          </div>

          {/* Links, not a control with state. Each range is a URL. */}
          <nav aria-label="Chart period" className="flex flex-wrap gap-1">
            {RANGES.map((option) => {
              const active = option.weeks === range.weeks;
              return (
                <Link
                  key={option.weeks}
                  href={
                    option.weeks === 12 ? "/app" : `/app?range=${option.weeks}`
                  }
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150 ${
                    active
                      ? "border-teal bg-shallow text-teal"
                      : "border-ash text-graphite hover:border-stone hover:text-ink"
                  }`}
                >
                  {option.short}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <MetricChart
            title="Messages sent"
            hero={String(totals.sent)}
            changePercent={change(totals.sent, previous.sent)}
            changeLabel={
              previous.sent > 0
                ? `${previous.sent} in the ${range.label.toLowerCase()} before`
                : "nothing sent before this"
            }
            points={weeks.map((week) => ({
              label: week.label,
              value: week.sent,
              display: `${week.sent} sent`,
            }))}
          />
          <MetricChart
            title="Members back"
            tone="returned"
            hero={String(totals.returned)}
            changePercent={change(totals.returned, previous.returned)}
            changeLabel={
              previous.returned > 0
                ? `${previous.returned} in the ${range.label.toLowerCase()} before`
                : "none came back before this"
            }
            points={weeks.map((week) => ({
              label: week.label,
              value: week.returned,
              display: `${week.returned} back`,
            }))}
          />
          <MetricChart
            title="Recovered"
            tone="amber"
            hero={formatMoney(totals.revenueMinor, currency)}
            changePercent={change(totals.revenueMinor, previous.revenueMinor)}
            changeLabel={
              previous.revenueMinor > 0
                ? `${formatMoney(previous.revenueMinor, currency)} in the ${range.label.toLowerCase()} before`
                : "nothing recovered before this"
            }
            points={weeks.map((week) => ({
              label: week.label,
              value: week.revenueMinor,
              display: formatMoney(week.revenueMinor, currency),
            }))}
          />
        </div>

        {/* The trend, at a size worth looking at, with the period before it
            drawn behind. Two lines on one axis is the one case where two series
            belong together: same measure, same unit, equal stretches of time. */}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <LineChart
            title="Revenue recovered"
            tone="amber"
            hero={formatMoney(totals.revenueMinor, currency)}
            changePercent={change(totals.revenueMinor, previous.revenueMinor)}
            caption="Each period at the price of the services actually booked. Not an average, and not a number casdey has billed."
            points={weeks.map((week) => ({
              label: week.label,
              value: week.revenueMinor,
              display: formatMoney(week.revenueMinor, currency),
            }))}
            comparison={previousWeeks.map((week) => ({
              value: week.revenueMinor,
            }))}
          />
          <LineChart
            title="Members back"
            tone="returned"
            hero={String(totals.returned)}
            changePercent={change(totals.returned, previous.returned)}
            caption="Booked through casdey, or seen again in a later import of your own list."
            points={weeks.map((week) => ({
              label: week.label,
              value: week.returned,
              display: `${week.returned} back`,
            }))}
            comparison={previousWeeks.map((week) => ({ value: week.returned }))}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>How far your list gets</CardTitle>
            <p className="mt-1 mb-5 text-[0.875rem] text-stone">
              Every stage as a share of the members who have gone quiet. This is
              the whole job in three numbers.
            </p>
            <Funnel
              stages={[
                {
                  label: "Gone quiet",
                  value: stats.lapsed,
                  hint: describeRule(rule),
                  tone: "teal",
                },
                {
                  label: "Written to",
                  value: stats.contacted,
                  hint:
                    stats.reachable < stats.lapsed
                      ? `${stats.lapsed - stats.reachable} of them have no email address casdey can use`
                      : "everyone quiet is reachable by email",
                  tone: "amber",
                },
                {
                  label: "Came back",
                  value: stats.returned,
                  hint: "booked through casdey, or seen again in a later import",
                  tone: "returned",
                },
              ]}
            />
          </Card>

          <Card>
            <CardTitle>Where your members stand</CardTitle>
            <p className="mt-1 mb-5 text-[0.875rem] text-stone">
              All {stats.members} of them, split by what casdey knows right now.
            </p>
            <Split
              total={stats.members}
              parts={[
                {
                  label: "Still coming",
                  value: Math.max(
                    stats.members -
                      stats.lapsed -
                      stats.contacted -
                      stats.returned,
                    0,
                  ),
                  tone: "quiet",
                },
                { label: "Gone quiet", value: stats.lapsed, tone: "teal" },
                { label: "Written to", value: stats.contacted, tone: "amber" },
                { label: "Came back", value: stats.returned, tone: "returned" },
              ]}
            />
          </Card>
        </div>
      </section>

      {returned ? (
        <Card className="mt-6">
          <CardTitle>Most recent return</CardTitle>
          <p className="mt-1 mb-5 text-[0.9375rem] text-graphite">
            {memberName(returned)} came back on{" "}
            <span className="literal text-ink">
              {formatDate(returned.returned_at)}
            </span>
            .
          </p>
          <MemberTimeline
            visitCount={returned.visit_count}
            monthsAway={monthsSince(returned.last_visit_at)}
            returned
          />
        </Card>
      ) : null}

      {stats.reachable > 0 ? (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Ready to work</CardTitle>
            <p className="text-[0.9375rem] text-graphite">
              <span className="literal font-medium text-ink">
                {stats.reachable}
              </span>{" "}
              lapsed {stats.reachable === 1 ? "member has" : "members have"}{" "}
              an email address on file. A campaign writes to them once, and
              stops.
            </p>
          </div>
          <ButtonLink href="/app/campaigns/new">Build a campaign</ButtonLink>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardTitle>No email addresses yet</CardTitle>
          <p className="text-[0.9375rem] text-graphite">
            {stats.lapsed} lapsed{" "}
            {stats.lapsed === 1 ? "member" : "members"}, none with an email
            address casdey can use. Re-import with the email column mapped and
            they become contactable.
          </p>
        </Card>
      )}

      {/* Below the numbers, deliberately. The checklist is scaffolding: it is
          there for the first week and then never again, while the dashboard is
          what the gym opens casdey to see for the rest of the relationship.
          Putting setup first made every visit start with a list of chores. */}
      {!setup.complete ? (
        <div className="mt-6">
          <SetupChecklist state={setup} />
        </div>
      ) : null}

      {/* After the checklist, because it is the consequence of it. Unlike the
          checklist this does not disappear when setup is complete: a gym mid
          free week still needs to know what day 7 does and how to opt out. */}
      {trialPanel ? <div className="mt-6">{trialPanel}</div> : null}
    </>
  );
}
