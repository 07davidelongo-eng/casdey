import { requireGym } from "@/lib/dal";
import { gymStats } from "@/lib/stats";
import { atRiskRuleFor, monthsSince, ruleFor } from "@/lib/lapse";
import {
  estimatedRecoveredMinor,
  formatMoney,
  gymCurrency,
} from "@/lib/money";
import { buildSetupState } from "@/lib/setup";
import { calendarConnectionView } from "@/lib/calendar/provider";
import { isGoogleCalendarConfigured } from "@/lib/calendar/google";
import { isCalendarKeyConfigured } from "@/lib/calendar/tokens";
import { isSendingConfigured } from "@/lib/email/domains";
import { MemberTimeline } from "@/components/app/member-timeline";
import { SetupChecklist } from "@/components/app/setup-checklist";
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

export default async function DashboardPage(props: PageProps<"/app">) {
  const params = await props.searchParams;
  const { gym, session } = await requireGym();

  const rule = ruleFor(gym);
  const stats = await gymStats(session.supabase, gym.id, rule, atRiskRuleFor(gym));

  // The first-run checklist. Derived from state the gym already has, so it
  // ticks itself off and disappears once setup is done, no flag to persist.
  const [{ count: approvedCampaigns }, calendar] = await Promise.all([
    session.supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gym.id)
      .not("approved_at", "is", null),
    calendarConnectionView(gym.id),
  ]);

  const setup = buildSetupState({
    memberCount: stats.members,
    bookingValueSet: gym.booking_value_minor !== null,
    lapsedAfterMonths: gym.lapsed_after_months,
    maxVisits: gym.max_visits,
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

  // The most recent return, if there is one. This is the only place the app
  // gets to show the thing it exists to cause.
  const { data: returnedRows } = await session.supabase
    .from("members")
    .select("*")
    .eq("gym_id", gym.id)
    .eq("is_test", false)
    .eq("status", "returned")
    .order("returned_at", { ascending: false })
    .limit(1);

  const returned = (returnedRows?.[0] ?? null) as Member | null;

  const currency = gymCurrency(gym);
  const recoveredMinor = estimatedRecoveredMinor(
    stats.returned,
    gym.booking_value_minor,
  );

  if (stats.members === 0) {
    return (
      <>
        <PageHeader eyebrow="Overview" title={gym.name} />
        {params.welcome ? (
          <div className="mb-6">
            <Notice>
              Your free week has started, everything unlocked and no card taken.
              Work through the steps below to see it go.
            </Notice>
          </div>
        ) : null}
        <SetupChecklist state={setup} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={gym.name}
        lede={`Lapsed means no visit for ${gym.lapsed_after_months} months, and at most ${gym.max_visits} ${
          gym.max_visits === 1 ? "visit" : "visits"
        } on record. Change that in settings.`}
        actions={
          <ButtonLink href="/app/campaigns/new">Build a campaign</ButtonLink>
        }
      />

      {params.started ? (
        <div className="mb-6">
          <Notice>
            Your free week has started. Nothing is charged for seven days.
          </Notice>
        </div>
      ) : null}

      {!setup.complete ? <SetupChecklist state={setup} /> : null}

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

      {recoveredMinor !== null ? (
        <Card className="mt-6">
          <p className="label text-stone">Estimated revenue recovered</p>
          <p className="literal mt-2 text-[2.5rem] leading-none font-medium text-[color-mix(in_srgb,var(--amber)_62%,var(--ink))]">
            {formatMoney(recoveredMinor, currency)}
          </p>
          <p className="mt-3 max-w-xl text-[0.8125rem] text-stone">
            {stats.returned} {stats.returned === 1 ? "member" : "members"}{" "}
            returned, valued at your typical{" "}
            {formatMoney(gym.booking_value_minor ?? 0, currency)} a
            recovered booking. An estimate, not amounts casdey has billed.
          </p>
        </Card>
      ) : (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>See the money, not just the count</CardTitle>
            <p className="text-[0.9375rem] text-graphite">
              Tell casdey what a returning member is typically worth and the
              dashboard shows the revenue you have recovered, not only how many
              came back.
            </p>
          </div>
          <ButtonLink href="/app/settings" variant="quiet">
            Set booking value
          </ButtonLink>
        </Card>
      )}

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
    </>
  );
}
