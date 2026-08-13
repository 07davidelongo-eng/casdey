import Link from "next/link";

import { requirePractice } from "@/lib/dal";
import { dormancyCutoff, monthsSince, ruleFor } from "@/lib/dormancy";
import {
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Pill,
  formatDate,
  patientName,
} from "@/components/app/ui";
import type { Patient } from "@/lib/types";

export const metadata = { title: "Patients" };

const PAGE_SIZE = 50;

type Filter = "dormant" | "all" | "contacted" | "rebooked";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "dormant", label: "Gone quiet" },
  { value: "contacted", label: "Contacted" },
  { value: "rebooked", label: "Rebooked" },
  { value: "all", label: "Everyone" },
];

export default async function PatientsPage(props: PageProps<"/app/patients">) {
  const params = await props.searchParams;
  const { practice, session } = await requirePractice();

  const filter: Filter = FILTERS.some((f) => f.value === params.filter)
    ? (params.filter as Filter)
    : "dormant";

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const rule = ruleFor(practice);
  const cutoff = dormancyCutoff(rule);

  let query = session.supabase
    .from("patients")
    .select("*", { count: "exact" })
    .eq("practice_id", practice.id);

  if (filter === "dormant") {
    query = query
      .neq("status", "opted_out")
      .lte("visit_count", rule.maxVisits)
      .lte("last_visit_at", cutoff);
  } else if (filter === "contacted") {
    query = query.eq("status", "contacted");
  } else if (filter === "rebooked") {
    query = query.eq("status", "reactivated");
  }

  const { data, count } = await query
    // Longest away first: those are the ones most worth writing to.
    .order("last_visit_at", { ascending: true, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);

  const patients = (data ?? []) as Patient[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Patients"
        title="Your list"
        lede="Sorted by how long they have been away. The longest gaps are at the top."
        actions={
          filter === "dormant" && total > 0 ? (
            <ButtonLink href="/app/campaigns/new">Build a campaign</ButtonLink>
          ) : undefined
        }
      />

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Filter patients">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={`/app/patients?filter=${option.value}`}
            aria-current={filter === option.value ? "page" : undefined}
            className={`rounded-[10px] border px-3.5 py-2 text-[0.875rem] font-medium transition-[transform,border-color] duration-200 hover:-translate-y-px ${
              filter === option.value
                ? "border-teal bg-shallow text-teal"
                : "border-ash bg-white text-graphite hover:border-stone"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {patients.length === 0 ? (
        <EmptyState
          title={
            filter === "dormant"
              ? "Nobody has gone quiet"
              : "Nothing here yet"
          }
          body={
            filter === "dormant"
              ? `No patient matches your current rule: no visit for ${practice.dormant_after_months} months and at most ${practice.max_visits} on record.`
              : "Once casdey starts writing to patients, they show up here."
          }
          action={<ButtonLink href="/app/import">Import your list</ButtonLink>}
        />
      ) : (
        <>
          <p className="mb-3 text-[0.875rem] text-stone">
            <span className="literal">{total}</span>{" "}
            {total === 1 ? "patient" : "patients"}
          </p>

          <Card className="!p-0 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Email</th>
                  <th>Last visit</th>
                  <th>Away</th>
                  <th>Visits</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => {
                  const away = monthsSince(patient.last_visit_at);
                  return (
                    <tr key={patient.id}>
                      <td className="font-medium text-ink">
                        <Link
                          href={`/app/patients/${patient.id}`}
                          className="hover:text-teal hover:underline"
                        >
                          {patientName(patient)}
                        </Link>
                      </td>
                      <td className="literal text-[0.8125rem]">
                        {patient.email ?? (
                          <span className="text-stone">no email</span>
                        )}
                      </td>
                      <td className="literal text-[0.8125rem]">
                        {formatDate(patient.last_visit_at)}
                      </td>
                      <td className="literal text-[0.8125rem]">
                        {away === null ? "unknown" : `${away} mo`}
                      </td>
                      <td className="literal text-[0.8125rem]">
                        {patient.visit_count}
                      </td>
                      <td>
                        <StatusPill patient={patient} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {pages > 1 ? (
            <nav
              className="mt-5 flex items-center justify-between"
              aria-label="Pages"
            >
              <PageLink
                href={`/app/patients?filter=${filter}&page=${page - 1}`}
                disabled={page === 1}
              >
                Previous
              </PageLink>
              <span className="literal text-[0.8125rem] text-stone">
                Page {page} of {pages}
              </span>
              <PageLink
                href={`/app/patients?filter=${filter}&page=${page + 1}`}
                disabled={page === pages}
              >
                Next
              </PageLink>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}

function StatusPill({ patient }: { patient: Patient }) {
  if (patient.status === "reactivated")
    return <Pill tone="rebooked">Rebooked</Pill>;
  if (patient.status === "opted_out") return <Pill>Opted out</Pill>;
  if (patient.status === "contacted") return <Pill tone="teal">Contacted</Pill>;
  if (!patient.email) return <Pill>No email</Pill>;
  return <Pill>Not contacted</Pill>;
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="text-[0.875rem] text-stone opacity-50">{children}</span>
    );
  }
  return (
    <Link
      href={href}
      className="text-[0.875rem] font-semibold text-teal underline underline-offset-4 hover:no-underline"
    >
      {children}
    </Link>
  );
}
