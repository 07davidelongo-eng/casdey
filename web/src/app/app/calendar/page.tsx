import Link from "next/link";

import { requireGym } from "@/lib/dal";
import { calendarFor } from "@/lib/calendar/provider";
import { formatMoney, gymCurrency } from "@/lib/money";
import {
  Card,
  CardTitle,
  Notice,
  PageHeader,
  Pill,
  memberName,
} from "@/components/app/ui";

export const metadata = { title: "Calendar" };

/**
 * What is actually in the diary, for the next fortnight (#50).
 *
 * Two sources, and the page is explicit about which is which. casdey's own
 * bookings come with a member, a service and a price, because casdey made
 * them. Everything else in the gym's Google Calendar arrives through free/busy
 * as a block of time with no title, and that is not a shortcoming to paper
 * over: casdey asks Google for the narrowest possible access, so it can see
 * that 6pm Tuesday is taken and deliberately cannot see what it is taken for.
 *
 * Saying so is better than either pretending to be Google Calendar or leaving
 * a gym wondering why the rest of its week is missing.
 */

const DAYS = 14;

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const TIME_LABEL = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  value_minor: number | null;
  offer_code: string | null;
  members: { first_name: string | null; last_name: string | null } | null;
  services: { name: string } | null;
};

export default async function CalendarPage() {
  const { gym, session } = await requireGym();

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + DAYS);

  const { data } = await session.supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, status, value_minor, offer_code, members(first_name, last_name), services(name)",
    )
    .eq("gym_id", gym.id)
    .neq("status", "cancelled")
    .gte("start_at", from.toISOString())
    .lt("start_at", to.toISOString())
    .order("start_at", { ascending: true });

  const bookings = (data ?? []) as unknown as BookingRow[];

  // Best effort. A dead connection is already reported loudly on the overview,
  // and this page is still worth showing without it.
  let busy: { start: Date; end: Date }[] = [];
  let calendarEmail: string | null = null;
  try {
    const calendar = await calendarFor(gym.id);
    if (calendar) {
      calendarEmail = calendar.connectedEmail;
      busy = (await calendar.getBusy(from, to)).map((interval) => ({
        start: new Date(interval.start),
        end: new Date(interval.end),
      }));
    }
  } catch {
    busy = [];
  }

  const currency = gymCurrency(gym);

  // One bucket per day, so an empty Wednesday is a visible empty Wednesday
  // rather than a gap between Tuesday and Thursday.
  const days: {
    date: Date;
    bookings: BookingRow[];
    busy: { start: Date; end: Date }[];
  }[] = [];

  for (let i = 0; i < DAYS; i += 1) {
    const date = new Date(from);
    date.setDate(date.getDate() + i);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);

    days.push({
      date,
      bookings: bookings.filter((booking) => {
        const at = new Date(booking.start_at);
        return at >= date && at < next;
      }),
      // A busy block casdey put there itself would otherwise appear twice, once
      // as the booking and once as the block it created in Google.
      busy: busy.filter((block) => {
        if (block.start < date || block.start >= next) return false;
        return !bookings.some(
          (booking) =>
            Math.abs(
              new Date(booking.start_at).getTime() - block.start.getTime(),
            ) < 60_000,
        );
      }),
    });
  }

  const total = bookings.length;

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="The next two weeks"
        lede={
          total === 0
            ? "Nothing booked yet. Bookings members make through casdey land here, and in your Google Calendar."
            : `${total} ${total === 1 ? "booking" : "bookings"} casdey has made for you, alongside the time your own diary already has taken.`
        }
      />

      {!calendarEmail ? (
        <div className="mb-6">
          <Notice tone="warn">
            No calendar connected, so casdey cannot see what your own diary
            already has in it and will not offer members any times.{" "}
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

      <div className="space-y-4">
        {days.map((day) => {
          const quiet = day.bookings.length === 0 && day.busy.length === 0;
          return (
            <Card key={day.date.toISOString()}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle>{DAY_LABEL.format(day.date)}</CardTitle>
                {day.bookings.length > 0 ? (
                  <Pill tone="teal">
                    {day.bookings.length}{" "}
                    {day.bookings.length === 1 ? "booking" : "bookings"}
                  </Pill>
                ) : null}
              </div>

              {quiet ? (
                <p className="text-[0.9375rem] text-stone">Nothing in.</p>
              ) : (
                <ul className="space-y-2">
                  {day.bookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-ash p-3"
                    >
                      <span className="literal text-[0.9375rem] font-medium text-ink">
                        {TIME_LABEL.format(new Date(booking.start_at))}
                        {" to "}
                        {TIME_LABEL.format(new Date(booking.end_at))}
                      </span>
                      <span className="text-[0.9375rem] text-ink">
                        {booking.members
                          ? memberName(booking.members)
                          : "A member"}
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

                  {day.busy.map((block) => (
                    <li
                      key={block.start.toISOString()}
                      className="flex flex-wrap items-baseline gap-x-3 rounded-lg bg-mist p-3"
                    >
                      <span className="literal text-[0.9375rem] text-graphite">
                        {TIME_LABEL.format(block.start)}
                        {" to "}
                        {TIME_LABEL.format(block.end)}
                      </span>
                      <span className="text-[0.875rem] text-stone">
                        Busy in your calendar
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {calendarEmail ? (
        <p className="mt-6 text-[0.875rem] text-stone">
          Reading{" "}
          <span className="literal text-graphite">{calendarEmail}</span>. casdey
          can see that a time is taken but not what it is taken for, because it
          asks Google for the narrowest access that lets it avoid double
          booking you.
        </p>
      ) : null}
    </>
  );
}
