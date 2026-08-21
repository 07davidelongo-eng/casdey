import Link from "next/link";

import { requireGym } from "@/lib/dal";
import { lapseCutoff, monthsSince, ruleFor } from "@/lib/lapse";
import {
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Pill,
  formatDate,
  memberName,
} from "@/components/app/ui";
import type { Member } from "@/lib/types";

export const metadata = { title: "Members" };

const PAGE_SIZE = 50;

type Filter = "lapsed" | "all" | "contacted" | "returned";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "lapsed", label: "Gone quiet" },
  { value: "contacted", label: "Contacted" },
  { value: "returned", label: "Returned" },
  { value: "all", label: "Everyone" },
];

export default async function MembersPage(props: PageProps<"/app/members">) {
  const params = await props.searchParams;
  const { gym, session } = await requireGym();

  const filter: Filter = FILTERS.some((f) => f.value === params.filter)
    ? (params.filter as Filter)
    : "lapsed";

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const rule = ruleFor(gym);
  const cutoff = lapseCutoff(rule);

  let query = session.supabase
    .from("members")
    .select("*", { count: "exact" })
    .eq("gym_id", gym.id)
    .eq("is_test", false);

  if (filter === "lapsed") {
    query = query
      .neq("status", "opted_out")
      .lte("visit_count", rule.maxVisits)
      .lte("last_visit_at", cutoff);
  } else if (filter === "contacted") {
    query = query.eq("status", "contacted");
  } else if (filter === "returned") {
    query = query.eq("status", "returned");
  }

  const { data, count } = await query
    // Longest away first: those are the ones most worth writing to.
    .order("last_visit_at", { ascending: true, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);

  const members = (data ?? []) as Member[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Members"
        title="Your list"
        lede="Sorted by how long they have been away. The longest gaps are at the top."
        actions={
          filter === "lapsed" && total > 0 ? (
            <ButtonLink href="/app/campaigns/new">Build a campaign</ButtonLink>
          ) : undefined
        }
      />

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Filter members">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={`/app/members?filter=${option.value}`}
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

      {members.length === 0 ? (
        <EmptyState
          title={
            filter === "lapsed"
              ? "Nobody has gone quiet"
              : "Nothing here yet"
          }
          body={
            filter === "lapsed"
              ? `No member matches your current rule: no visit for ${gym.lapsed_after_months} months and at most ${gym.max_visits} on record.`
              : "Once casdey starts writing to members, they show up here."
          }
          action={<ButtonLink href="/app/import">Import your list</ButtonLink>}
        />
      ) : (
        <>
          <p className="mb-3 text-[0.875rem] text-stone">
            <span className="literal">{total}</span>{" "}
            {total === 1 ? "member" : "members"}
          </p>

          <Card className="!p-0 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Last visit</th>
                  <th>Away</th>
                  <th>Visits</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const away = monthsSince(member.last_visit_at);
                  return (
                    <tr key={member.id}>
                      <td className="font-medium text-ink">
                        <Link
                          href={`/app/members/${member.id}`}
                          className="hover:text-teal hover:underline"
                        >
                          {memberName(member)}
                        </Link>
                      </td>
                      <td className="literal text-[0.8125rem]">
                        {member.email ?? (
                          <span className="text-stone">no email</span>
                        )}
                      </td>
                      <td className="literal text-[0.8125rem]">
                        {formatDate(member.last_visit_at)}
                      </td>
                      <td className="literal text-[0.8125rem]">
                        {away === null ? "unknown" : `${away} mo`}
                      </td>
                      <td className="literal text-[0.8125rem]">
                        {member.visit_count}
                      </td>
                      <td>
                        <StatusPill member={member} />
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
                href={`/app/members?filter=${filter}&page=${page - 1}`}
                disabled={page === 1}
              >
                Previous
              </PageLink>
              <span className="literal text-[0.8125rem] text-stone">
                Page {page} of {pages}
              </span>
              <PageLink
                href={`/app/members?filter=${filter}&page=${page + 1}`}
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

function StatusPill({ member }: { member: Member }) {
  if (member.status === "returned")
    return <Pill tone="returned">Returned</Pill>;
  if (member.status === "opted_out") return <Pill>Opted out</Pill>;
  if (member.status === "contacted") return <Pill tone="teal">Contacted</Pill>;
  if (!member.email) return <Pill>No email</Pill>;
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
