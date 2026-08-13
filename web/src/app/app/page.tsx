import { requirePractice } from "@/lib/dal";
import { practiceStats } from "@/lib/stats";
import { monthsSince, ruleFor } from "@/lib/dormancy";
import { PatientTimeline } from "@/components/app/patient-timeline";
import {
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  Notice,
  PageHeader,
  Stat,
  formatDate,
  patientName,
} from "@/components/app/ui";
import type { Patient } from "@/lib/types";

export const metadata = { title: "Overview" };

export default async function DashboardPage(props: PageProps<"/app">) {
  const params = await props.searchParams;
  const { practice, session } = await requirePractice();

  const rule = ruleFor(practice);
  const stats = await practiceStats(session.supabase, practice.id, rule);

  // The most recent rebooking, if there is one. This is the only place the app
  // gets to show the thing it exists to cause.
  const { data: rebookedRows } = await session.supabase
    .from("patients")
    .select("*")
    .eq("practice_id", practice.id)
    .eq("status", "reactivated")
    .order("reactivated_at", { ascending: false })
    .limit(1);

  const rebooked = (rebookedRows?.[0] ?? null) as Patient | null;

  if (stats.patients === 0) {
    return (
      <>
        <PageHeader eyebrow="Overview" title={practice.name} />
        {params.started ? (
          <div className="mb-6">
            <Notice>
              Your free week has started. Nothing is charged for seven days.
            </Notice>
          </div>
        ) : null}
        <EmptyState
          title="Nothing to work with yet"
          body="Import your patient list and casdey will show you who came once or twice and never came back."
          action={<ButtonLink href="/app/import">Import your list</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={practice.name}
        lede={`Dormant means no visit for ${practice.dormant_after_months} months, and at most ${practice.max_visits} ${
          practice.max_visits === 1 ? "visit" : "visits"
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Patients" value={stats.patients} />
        <Stat
          label="Gone quiet"
          value={stats.dormant}
          tone="teal"
          hint={
            stats.reachable < stats.dormant
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
          label="Rebooked"
          value={stats.rebooked}
          tone="rebooked"
          hint="came back after we wrote"
        />
      </div>

      {rebooked ? (
        <Card className="mt-6">
          <CardTitle>Most recent return</CardTitle>
          <p className="mt-1 mb-5 text-[0.9375rem] text-graphite">
            {patientName(rebooked)} came back on{" "}
            <span className="literal text-ink">
              {formatDate(rebooked.reactivated_at)}
            </span>
            .
          </p>
          <PatientTimeline
            visitCount={rebooked.visit_count}
            monthsAway={monthsSince(rebooked.last_visit_at)}
            rebooked
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
              dormant {stats.reachable === 1 ? "patient has" : "patients have"}{" "}
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
            {stats.dormant} dormant{" "}
            {stats.dormant === 1 ? "patient" : "patients"}, none with an email
            address casdey can use. Re-import with the email column mapped and
            they become contactable.
          </p>
        </Card>
      )}
    </>
  );
}
