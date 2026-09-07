import Link from "next/link";

import { requireGym } from "@/lib/dal";
import {
  describeRule,
  lapseCutoff,
  monthsSince,
  ruleFor,
  visitCeiling,
} from "@/lib/lapse";
import { capabilities } from "@/lib/plan";
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

// Ten, matching the audit log and the import history. A gym with a thousand
// members should never be asked to scroll to find one.
const PAGE_SIZE = 10;

type Filter = "lapsed" | "all" | "contacted" | "returned";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "lapsed", label: "Gone quiet" },
  { value: "contacted", label: "Contacted" },
  { value: "returned", label: "Returned" },
  { value: "all", label: "Everyone" },
];

/**
 * Sorting, and why it is done in the database rather than in the page.
 *
 * The other lists in casdey filter in the browser over rows already fetched,
 * which is right for a few hundred audit entries. A member list is the one
 * place that does not hold: it is the biggest table a gym has, it is paged
 * server-side already, and sorting one page of ten would sort ten rows out of
 * a thousand and look broken.
 *
 * "Away" is not a column. It is derived from last_visit_at and is exactly its
 * inverse, so sorting by one sorts by the other and there is nothing to store.
 */
type SortKey = "last_visit" | "visits" | "name" | "email" | "status";

const SORT_COLUMN: Record<SortKey, string> = {
  last_visit: "last_visit_at",
  visits: "visit_count",
  name: "first_name",
  email: "email",
  status: "status",
};

function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && value in SORT_COLUMN;
}

export default async function MembersPage(props: PageProps<"/app/members">) {
  const params = await props.searchParams;
  const { gym, session } = await requireGym();

  const filter: Filter = FILTERS.some((f) => f.value === params.filter)
    ? (params.filter as Filter)
    : "lapsed";

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const sort: SortKey = isSortKey(params.sort) ? params.sort : "last_visit";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  /** Keeps every control the gym has set while changing one of them. */
  const link = (patch: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams({ filter });
    if (q) search.set("q", q);
    if (sort !== "last_visit") search.set("sort", sort);
    if (dir !== "asc") search.set("dir", dir);
    if (page > 1) search.set("page", String(page));
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "") search.delete(key);
      else search.set(key, String(value));
    }
    return `/app/members?${search.toString()}`;
  };

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
      .lte("visit_count", visitCeiling(rule))
      .lte("last_visit_at", cutoff);
  } else if (filter === "contacted") {
    query = query.eq("status", "contacted");
  } else if (filter === "returned") {
    query = query.eq("status", "returned");
  }

  if (q) {
    // Matched in the database so it searches the whole list, not the ten rows
    // that happen to be on screen. Commas and parentheses would end the or()
    // expression early, so they are stripped rather than escaped.
    const needle = q.replace(/[,()*]/g, " ").trim();
    if (needle) {
      query = query.or(
        [
          `first_name.ilike.%${needle}%`,
          `last_name.ilike.%${needle}%`,
          `email.ilike.%${needle}%`,
        ].join(","),
      );
    }
  }

  const { data, count } = await query
    // Longest away first by default: those are the ones most worth writing to.
    .order(SORT_COLUMN[sort], { ascending: dir === "asc", nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);

  const members = (data ?? []) as Member[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Free sees only the first few records by name; the true total stays visible
  // so the size of the opportunity is never hidden (see plan.ts). Trial and
  // Premium have no cap and page through the whole list.
  const limit = capabilities(gym).memberListLimit;
  const visibleMembers = limit != null ? members.slice(0, limit) : members;
  const hiddenCount =
    limit != null ? Math.max(0, total - visibleMembers.length) : 0;
  const showPagination = limit == null && pages > 1;

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

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* A plain GET form, so searching survives a reload, can be linked to,
            and works before any JavaScript has run. */}
        <form action="/app/members" className="flex items-center gap-2">
          <input type="hidden" name="filter" value={filter} />
          {sort !== "last_visit" ? (
            <input type="hidden" name="sort" value={sort} />
          ) : null}
          {dir !== "asc" ? <input type="hidden" name="dir" value={dir} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search a name or an email address"
            aria-label="Search members"
            className="field min-w-[18rem] sm:w-[24rem]"
          />
          <button
            type="submit"
            className="text-[0.875rem] font-semibold text-teal underline underline-offset-4"
          >
            Search
          </button>
        </form>
        {q ? (
          <Link
            href={link({ q: undefined, page: undefined })}
            className="text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
          >
            Clear
          </Link>
        ) : null}
      </div>

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
              ? `No member matches your current rule: ${describeRule(rule)}.`
              : "Once casdey starts writing to members, they show up here."
          }
          action={<ButtonLink href="/app/import">Import your list</ButtonLink>}
        />
      ) : (
        <>
          <p className="mb-3 text-[0.875rem] text-stone">
            <span className="literal">{total}</span>{" "}
            {total === 1 ? "member" : "members"}
            {q ? (
              <>
                {" "}
                matching <span className="literal">{q}</span>
              </>
            ) : null}
          </p>

          <Card className="!p-0 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <SortHeader label="Member" column="name" sort={sort} dir={dir} link={link} />
                  <SortHeader label="Email" column="email" sort={sort} dir={dir} link={link} />
                  <SortHeader
                    label="Last visit"
                    column="last_visit"
                    sort={sort}
                    dir={dir}
                    link={link}
                  />
                  {/* Away is last_visit read the other way round, so it shares
                      its column rather than pretending to be its own. */}
                  <SortHeader
                    label="Away"
                    column="last_visit"
                    sort={sort}
                    dir={dir}
                    link={link}
                  />
                  <SortHeader label="Visits" column="visits" sort={sort} dir={dir} link={link} />
                  <SortHeader label="Status" column="status" sort={sort} dir={dir} link={link} />
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((member) => {
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

          {hiddenCount > 0 ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-[12px] border border-dashed border-ash bg-shallow px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.875rem] text-graphite">
                <span aria-hidden="true">🔒 </span>
                <span className="literal">{hiddenCount}</span> more{" "}
                {hiddenCount === 1 ? "member is" : "members are"} hidden on the
                Free plan. Upgrade to see everyone and start winning them back.
              </p>
              <ButtonLink href="/app/settings/billing">Upgrade</ButtonLink>
            </div>
          ) : null}

          {showPagination ? (
            <nav
              className="mt-5 flex flex-wrap items-center gap-5"
              aria-label="Pages"
            >
              <PageLink href={link({ page: page - 1 })} disabled={page === 1}>
                &larr; Previous
              </PageLink>
              <span className="literal text-[0.8125rem] text-stone">
                Page {page} of {pages}
              </span>
              <PageLink href={link({ page: page + 1 })} disabled={page === pages}>
                Next &rarr;
              </PageLink>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}

/** A column header that sorts, and says which way it is sorting. */
function SortHeader({
  label,
  column,
  sort,
  dir,
  link,
}: {
  label: string;
  column: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  link: (patch: Record<string, string | number | undefined>) => string;
}) {
  const active = sort === column;
  // Clicking the column you are already on reverses it; a new column starts
  // ascending, which for dates means longest-away first.
  const next = active && dir === "asc" ? "desc" : "asc";

  return (
    <th aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={link({ sort: column, dir: next, page: undefined })}
        className={`inline-flex items-center gap-1 ${active ? "text-ink" : ""}`}
      >
        {label}
        <span aria-hidden="true" className="text-[0.625rem]">
          {active ? (dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </Link>
    </th>
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
