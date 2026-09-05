import { CountUp, Typed } from "./motion";
import { Logo } from "./wordmark";

/**
 * casdey's own interface, drawn rather than screenshotted.
 *
 * The page used to argue for the product with abstractions: a field of dots,
 * a timeline. A gym owner does not buy a diagram of a problem, they buy the
 * screen they will be looking at, which is why every software site worth
 * copying puts the interface itself in the hero.
 *
 * Built in markup instead of captured as a PNG so it stays sharp at any
 * width, re-themes with the tokens, and never goes stale against the real
 * app. The numbers are invented and the caption under it says so.
 */

export type View = "members" | "offer" | "campaign" | "booking";

const NAV = [
  "Overview",
  "Members",
  "Import",
  "Offer",
  "Campaigns",
  "Settings",
] as const;

const ACTIVE_NAV: Record<View, string> = {
  members: "Members",
  offer: "Offer",
  campaign: "Campaigns",
  booking: "Overview",
};

const MEMBERS = [
  ["J. Okafor", "sep 2023", "17 months", "2", "€468", "lapsed"],
  ["L. Moreau", "dec 2023", "14 months", "31", "€1,068", "lapsed"],
  ["S. Bianchi", "apr 2023", "22 months", "8", "€540", "lapsed"],
  ["A. Kelly", "nov 2023", "11 months", "46", "€1,068", "lapsed"],
  ["D. Novak", "apr 2024", "6 months", "12", "€720", "lapsed"],
  ["R. Haugen", "this week", "back", "74", "€1,068", "returned"],
];

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-ash bg-white shadow-float">
      <div className="flex h-9 items-center gap-2 border-b border-ash bg-mist px-4">
        <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-white px-3 py-0.5 text-[11px] text-stone">
          casdey.com/app
        </span>
      </div>

      <div className="grid min-h-[366px] grid-cols-1 sm:grid-cols-[168px_1fr]">
        {children}
      </div>
    </div>
  );
}

function Sidebar({ active }: { active: string }) {
  return (
    <div className="hidden border-r border-ash bg-paper/70 p-3 sm:block sm:p-4">
      <Logo className="text-[1.05rem] text-ink" />
      <nav className="mt-5 flex flex-col gap-0.5">
        {NAV.map((item) => (
          <span
            key={item}
            className={
              "rounded-md px-2.5 py-1.5 text-[12px] sm:text-[13px] " +
              (item === active
                ? "bg-white font-medium text-ink shadow-raised"
                : "text-stone")
            }
          >
            {item}
          </span>
        ))}
      </nav>
    </div>
  );
}

function Pill({ kind }: { kind: string }) {
  const styles =
    kind === "returned"
      ? "bg-[color-mix(in_srgb,var(--amber)_14%,transparent)] text-amber"
      : kind === "active"
        ? "bg-mist text-graphite"
        : "bg-shallow text-teal";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}
    >
      {kind}
    </span>
  );
}

function Members() {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="display text-[1.15rem] text-ink">Members</h3>
        <p className="text-[12px] text-stone">
          <CountUp to={412} /> members
          <span className="mx-1.5 text-ash">·</span>
          <span className="text-teal">
            <CountUp to={168} /> lapsed
          </span>
          <span className="mx-1.5 text-ash">·</span>
          worth <CountUp to={14900} prefix="€" />
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-ash">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-paper/80 text-[11px] text-stone">
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Last visit</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">
                Away
              </th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">
                Visits
              </th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Worth</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-[12px] sm:text-[13px]">
            {MEMBERS.map(([name, last, away, visits, worth, status]) => (
              <tr key={name} className="border-t border-ash">
                <td className="px-3 py-2.5 font-medium text-ink">{name}</td>
                <td className="px-3 py-2.5 text-graphite">{last}</td>
                <td className="hidden px-3 py-2.5 text-graphite tabular-nums sm:table-cell">
                  {away}
                </td>
                <td className="hidden px-3 py-2.5 text-graphite tabular-nums sm:table-cell">
                  {visits}
                </td>
                <td className="hidden px-3 py-2.5 text-ink tabular-nums sm:table-cell">{worth}</td>
                <td className="px-3 py-2.5">
                  <Pill kind={status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Offer() {
  const rows = [
    ["Monthly membership", "€89 / month", "104 lapsed"],
    ["Annual membership", "€890 / year", "38 lapsed"],
    ["10-class pack", "€120", "26 lapsed"],
  ];
  return (
    <div className="p-4 sm:p-6">
      <h3 className="display text-[1.15rem] text-ink">
        What the quiet list is worth
      </h3>
      <p className="mt-4 display text-[2.4rem] leading-none text-ink tabular-nums">
        <CountUp to={14900} prefix="€" />
      </p>
      <p className="mt-2 text-[12px] text-stone">
        168 lapsed members, valued at your own prices
      </p>

      <div className="mt-5 overflow-hidden rounded-lg border border-ash">
        {rows.map(([name, price, count], i) => (
          <div
            key={name}
            className={
              "flex items-center justify-between gap-3 px-3 py-2.5 text-[12px] sm:text-[13px] " +
              (i ? "border-t border-ash" : "")
            }
          >
            <span className="text-ink">{name}</span>
            <span className="ml-auto text-graphite tabular-nums">{price}</span>
            <span className="w-20 text-right text-stone tabular-nums">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Campaign() {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="display text-[1.15rem] text-ink">Win-back, September</h3>
        <span className="rounded-full bg-shallow px-2 py-0.5 text-[11px] font-medium text-teal">
          awaiting your approval
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-ash">
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-ash px-3 py-2.5 text-[12px]">
          <span className="text-stone">
            To <span className="text-ink">168 lapsed members</span>
          </span>
          <span className="text-stone">
            From{" "}
            <span className="text-ink">
              Iron Works Gym &lt;hello@ironworks.ie&gt;
            </span>
          </span>
        </div>
        <div className="px-3 py-3 text-[12px] leading-relaxed text-graphite sm:text-[13px]">
          <p className="font-medium text-ink">
            Hi <span className="font-semibold text-teal">Joseph</span>,
          </p>
          <p className="mt-2">
            <Typed text="It has been a while since your last visit with us. Want me to find you a time to come back in?" />
          </p>
          <p className="mt-2">Sarah, Iron Works Gym</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-[8px] bg-teal-bright px-3 py-1.5 text-[12px] font-semibold text-deep">
          Approve and send
        </span>
        <span className="rounded-[8px] border border-ash px-3 py-1.5 text-[12px] text-ink">
          Send me a test
        </span>
      </div>
    </div>
  );
}

function Booking() {
  const slots = [
    ["09:00", "", false],
    ["11:00", "Kettlebell class", false],
    ["14:30", "J. Okafor · PT session, 45 min", true],
    ["17:00", "Open gym", false],
  ] as const;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="display text-[1.15rem] text-ink">Tuesday 16 September</h3>
        <p className="text-[12px] text-stone">Your Google Calendar</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-ash">
        {slots.map(([time, label, booked], i) => (
          <div
            key={time}
            className={
              "flex items-center gap-3 px-3 py-3 text-[12px] sm:text-[13px] " +
              (i ? "border-t border-ash " : "") +
              (booked
                ? "bg-[color-mix(in_srgb,var(--amber)_9%,transparent)]"
                : "")
            }
          >
            <span className="w-12 shrink-0 text-stone tabular-nums">
              {time}
            </span>
            {booked ? (
              <>
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber" />
                <span className="font-medium text-ink">{label}</span>
                <span className="ml-auto text-[11px] font-medium text-amber">
                  booked by casdey
                </span>
              </>
            ) : (
              <span className="text-graphite">{label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const VIEWS: Record<View, () => React.ReactElement> = {
  members: Members,
  offer: Offer,
  campaign: Campaign,
  booking: Booking,
};

export function AppShot({ view }: { view: View }) {
  const Body = VIEWS[view];
  return (
    <Chrome>
      <Sidebar active={ACTIVE_NAV[view]} />
      <Body />
    </Chrome>
  );
}
