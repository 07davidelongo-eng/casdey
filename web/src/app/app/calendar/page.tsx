import Link from "next/link";

import { requireGym } from "@/lib/dal";
import { calendarFor } from "@/lib/calendar/provider";
import { formatMoney, gymCurrency } from "@/lib/money";
import { Card, CardTitle, Notice, PageHeader, memberName } from "@/components/app/ui";
import { GoogleEmbed } from "./embed";

export const metadata = { title: "Calendar" };

/**
 * A month, laid out like a month (#62).
 *
 * The first attempt was a list of the next fourteen days, which is a diary
 * only in the sense that a receipt is a spreadsheet. A calendar has to be a
 * grid: seven columns, the weeks stacked, a date you can point at. That shape
 * is what lets somebody see at a glance that next Tuesday is empty and the
 * Thursday after it is full, which is the entire reason to open the page.
 *
 * Two sources on it, and it says which is which. casdey's own bookings carry a
 * member, a service and a price, because casdey made them. Everything else in
 * the gym's diary arrives through free/busy as a block of time with no title,
 * and that is deliberate rather than a gap: casdey asks Google for the
 * narrowest access that lets it avoid double-booking, so it can see that 6pm is
 * taken and cannot see what it is taken for. The gym's own Google Calendar can
 * be embedded underneath for the rest.
 *
 * Navigation is links, not state. A month is a URL, so it can be shared,
 * reloaded and opened in a new tab, and it works before any JavaScript does.
 */

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  value_minor: number | null;
  offer_code: string | null;
  members: { first_name: string | null; last_name: string | null } | null;
  services: { name: string } | null;
};

type Busy = { start: Date; end: Date };

// Local, not UTC. Every Date here is built from local parts (new Date(y, m,
// 1) is local midnight), so formatting them in UTC shifts them backwards for
// anyone east of Greenwich and labelled September as August.
const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** YYYY-MM-DD in local terms, which is how the grid is keyed. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function parseMonth(value: unknown, today: Date): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function monthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage(props: PageProps<"/app/calendar">) {
  const params = await props.searchParams;
  const { gym, session } = await requireGym();

  const today = new Date();
  const monthStart = parseMonth(params.month, today);

  // The grid starts on the Monday on or before the 1st and runs six weeks, so
  // every month is the same height and the page does not jump as you page
  // through it.
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 42);

  const { data } = await session.supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, value_minor, offer_code, members(first_name, last_name), services(name)",
    )
    .eq("gym_id", gym.id)
    .neq("status", "cancelled")
    .gte("start_at", gridStart.toISOString())
    .lt("start_at", gridEnd.toISOString())
    .order("start_at", { ascending: true });

  const bookings = (data ?? []) as unknown as BookingRow[];

  let busy: Busy[] = [];
  let calendarEmail: string | null = null;
  try {
    const calendar = await calendarFor(gym.id);
    if (calendar) {
      calendarEmail = calendar.connectedEmail;
      busy = (await calendar.getBusy(gridStart, gridEnd)).map((interval) => ({
        start: new Date(interval.start),
        end: new Date(interval.end),
      }));
    }
  } catch {
    // A dead connection is reported loudly on the overview. The grid is still
    // worth drawing without it.
    busy = [];
  }

  const byDay = new Map<string, { bookings: BookingRow[]; busy: Busy[] }>();
  const bucket = (key: string) => {
    let entry = byDay.get(key);
    if (!entry) {
      entry = { bookings: [], busy: [] };
      byDay.set(key, entry);
    }
    return entry;
  };

  for (const booking of bookings) {
    bucket(dayKey(new Date(booking.start_at))).bookings.push(booking);
  }
  for (const block of busy) {
    // A block casdey created itself would otherwise show twice, once as the
    // booking and once as the hole it punched in the gym's diary.
    const clash = bookings.some(
      (booking) =>
        Math.abs(new Date(booking.start_at).getTime() - block.start.getTime()) <
        60_000,
    );
    if (!clash) bucket(dayKey(block.start)).busy.push(block);
  }

  const selectedKey =
    typeof params.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.day)
      ? params.day
      : dayKey(today);

  const selected = byDay.get(selectedKey) ?? { bookings: [], busy: [] };
  const selectedDate = new Date(`${selectedKey}T12:00:00`);

  const previous = new Date(monthStart);
  previous.setMonth(previous.getMonth() - 1);
  const next = new Date(monthStart);
  next.setMonth(next.getMonth() + 1);

  const currency = gymCurrency(gym);
  const todayKey = dayKey(today);

  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + index);
    return date;
  });

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title={MONTH_LABEL.format(monthStart)}
        lede="Everything casdey has booked for you, on the days it falls. Times your own diary already has taken show as busy."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/app/calendar?month=${monthParam(previous)}`}
              aria-label="Previous month"
              className="rounded-md border border-ash px-3 py-2 text-[0.9375rem] text-graphite hover:border-stone hover:text-ink"
            >
              &larr;
            </Link>
            <Link
              href="/app/calendar"
              className="rounded-md border border-ash px-3 py-2 text-[0.875rem] text-graphite hover:border-stone hover:text-ink"
            >
              Today
            </Link>
            <Link
              href={`/app/calendar?month=${monthParam(next)}`}
              aria-label="Next month"
              className="rounded-md border border-ash px-3 py-2 text-[0.9375rem] text-graphite hover:border-stone hover:text-ink"
            >
              &rarr;
            </Link>
          </div>
        }
      />

      {!calendarEmail ? (
        <div className="mb-6">
          <Notice tone="warn">
            No calendar connected, so casdey cannot see what your own diary
            already holds and will not offer members any times.{" "}
            <Link
              href="/app/settings/booking"
              className="text-teal underline underline-offset-4"
            >
              Connect Google Calendar
            </Link>{" "}
            to switch booking on.
          </Notice>
        </div>
      ) : null}

      <Card className="!p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-ash">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center text-[0.75rem] font-medium text-stone"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date) => {
            const key = dayKey(date);
            const entry = byDay.get(key);
            const outside = date.getMonth() !== monthStart.getMonth();
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const events = entry?.bookings ?? [];
            const blocks = entry?.busy ?? [];

            return (
              <Link
                key={key}
                href={`/app/calendar?month=${monthParam(monthStart)}&day=${key}`}
                aria-current={isSelected ? "date" : undefined}
                className={`min-h-[7rem] border-r border-b border-ash p-2 text-left transition-colors last:border-r-0 ${
                  outside ? "bg-mist/40" : "hover:bg-mist/60"
                } ${isSelected ? "ring-2 ring-teal ring-inset" : ""}`}
              >
                <span
                  className={`literal inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.8125rem] ${
                    isToday
                      ? "bg-teal font-medium text-white"
                      : outside
                        ? "text-stone"
                        : "text-graphite"
                  }`}
                >
                  {date.getDate()}
                </span>

                <span className="mt-1 block space-y-1">
                  {events.slice(0, 2).map((booking) => (
                    <span
                      key={booking.id}
                      className="block truncate rounded bg-shallow px-1.5 py-0.5 text-[0.6875rem] text-teal"
                    >
                      {TIME.format(new Date(booking.start_at))}{" "}
                      {booking.members ? memberName(booking.members) : "Member"}
                    </span>
                  ))}
                  {events.length > 2 ? (
                    <span className="block px-1.5 text-[0.6875rem] text-stone">
                      +{events.length - 2} more
                    </span>
                  ) : null}
                  {events.length === 0 && blocks.length > 0 ? (
                    <span className="block px-1.5 text-[0.6875rem] text-stone">
                      {blocks.length} busy
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="mt-6">
        <CardTitle>{DAY_LABEL.format(selectedDate)}</CardTitle>

        {selected.bookings.length === 0 && selected.busy.length === 0 ? (
          <p className="mt-3 text-[0.9375rem] text-stone">
            Nothing in. Members who book through casdey land here.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {selected.bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-ash p-3"
              >
                <span className="literal text-[0.9375rem] font-medium text-ink">
                  {TIME.format(new Date(booking.start_at))} to{" "}
                  {TIME.format(new Date(booking.end_at))}
                </span>
                <span className="text-[0.9375rem] text-ink">
                  {booking.members ? memberName(booking.members) : "A member"}
                </span>
                {booking.services ? (
                  <span className="text-[0.875rem] text-graphite">
                    {booking.services.name}
                  </span>
                ) : null}
                {booking.value_minor ? (
                  <span className="literal text-[0.875rem] text-stone">
                    {formatMoney(booking.value_minor, currency)}
                  </span>
                ) : null}
                {booking.offer_code ? (
                  <span className="literal ml-auto text-[0.8125rem] text-stone">
                    Offer {booking.offer_code}
                  </span>
                ) : null}
              </li>
            ))}

            {selected.busy.map((block) => (
              <li
                key={block.start.toISOString()}
                className="flex flex-wrap items-baseline gap-x-3 rounded-lg bg-mist p-3"
              >
                <span className="literal text-[0.9375rem] text-graphite">
                  {TIME.format(block.start)} to {TIME.format(block.end)}
                </span>
                <span className="text-[0.875rem] text-stone">
                  Busy in your own calendar
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {calendarEmail ? (
        <GoogleEmbed email={calendarEmail} timeZone={gym.timezone} />
      ) : null}
    </>
  );
}
