import type { BookingHours, Weekday } from "../types";

/**
 * Computing the open slots a patient may pick from.
 *
 * This is the heart of booking and the easiest place to get quietly wrong, so
 * it is pure: given the practice's weekly hours, its timezone, the slot shape,
 * and the busy intervals (Google free/busy merged with existing casdey
 * appointments), it returns the bookable slots as absolute instants. No
 * database, no network, no clock except the `now` passed in, so every rule
 * below is unit tested (see availability.test.ts).
 *
 * Timezone handling: hours are wall-clock local to the practice ("09:00" means
 * 9am where the practice is), so each candidate is built in local time and then
 * converted to a UTC instant using the zone's offset AT THAT DATE, which is
 * what makes the set shift correctly across a daylight-saving boundary.
 */

export type Interval = { start: Date; end: Date };

export type SlotConfig = {
  hours: BookingHours;
  /** IANA timezone, e.g. "Europe/London". */
  timezone: string;
  slotMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  horizonDays: number;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * The offset (local = utc + offset) of a timezone at a given instant, in ms.
 * Uses Intl to read the wall-clock the zone shows for that instant and diffs it
 * against the same fields read as UTC.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * A wall-clock local time (year/month/day/hour/minute in `timeZone`) as a UTC
 * instant. One offset iteration is enough away from the ~1h DST-transition
 * windows, which no practice books appointments inside.
 */
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

const SHORT_WEEKDAY: Record<string, Weekday> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

/** The year/month/day/weekday the given instant falls on, in `timeZone`. */
function localDateParts(instant: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  weekday: Weekday;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // Read straight from Intl rather than re-parsing a formatted string, which
    // would round-trip through the server's own timezone and can slip a day.
    weekday: SHORT_WEEKDAY[get("weekday")] ?? "sun",
  };
}

function parseHHMM(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * The bookable slots between `now` and the horizon.
 *
 * Rules, all tested:
 *   - a slot lies fully inside one of its weekday's open windows;
 *   - slots step by slotMinutes from each window's start;
 *   - a slot must start at least minNoticeHours from now;
 *   - a slot must start before now + horizonDays;
 *   - a slot is dropped if any busy interval overlaps [start, end + buffer),
 *     which keeps bufferMinutes clear before the next thing in the diary.
 */
export function openSlots(
  config: SlotConfig,
  busy: Interval[],
  now: Date = new Date(),
): Interval[] {
  const slotMs = config.slotMinutes * MINUTE;
  const bufferMs = config.bufferMinutes * MINUTE;
  const earliest = new Date(now.getTime() + config.minNoticeHours * 60 * MINUTE);
  const horizonEnd = new Date(now.getTime() + config.horizonDays * DAY);

  const slots: Interval[] = [];

  // Walk calendar dates in the practice's own timezone. Start a day early so a
  // window that began before `now` but still has bookable slots is not missed,
  // and end a day late so the horizon's final day is fully covered.
  for (let offset = -1; offset <= config.horizonDays + 1; offset++) {
    const dayInstant = new Date(now.getTime() + offset * DAY);
    const { year, month, day, weekday } = localDateParts(
      dayInstant,
      config.timezone,
    );
    const windows = config.hours[weekday];
    if (!windows) continue;

    for (const [rawStart, rawEnd] of windows) {
      const start = parseHHMM(rawStart);
      const end = parseHHMM(rawEnd);
      if (!start || !end) continue;

      const windowStart = localToUtc(
        year,
        month,
        day,
        start.hour,
        start.minute,
        config.timezone,
      );
      const windowEnd = localToUtc(
        year,
        month,
        day,
        end.hour,
        end.minute,
        config.timezone,
      );

      for (
        let slotStart = windowStart.getTime();
        slotStart + slotMs <= windowEnd.getTime();
        slotStart += slotMs
      ) {
        const slot: Interval = {
          start: new Date(slotStart),
          end: new Date(slotStart + slotMs),
        };

        if (slot.start < earliest) continue;
        if (slot.start >= horizonEnd) continue;

        const guarded: Interval = {
          start: slot.start,
          end: new Date(slot.end.getTime() + bufferMs),
        };
        if (busy.some((b) => overlaps(guarded, b))) continue;

        slots.push(slot);
      }
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}
