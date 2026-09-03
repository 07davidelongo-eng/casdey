import "server-only";

import { supabaseAdmin } from "../supabase";
import type { Gym } from "../types";
import { openSlots, type Interval } from "./availability";
import { calendarFor, calendarNeedsReauth } from "./provider";

/**
 * A gym that relies on an external calendar we currently cannot read. Booking
 * must surface this rather than offer slots it could not verify: showing a slot
 * as free when the gym's real diary says otherwise is a double-booking, the one
 * outcome the connected calendar exists to prevent. Thrown by gymOpenSlots;
 * callers turn it into an explicit "we cannot show times right now" state.
 */
export class CalendarUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("The gym's calendar could not be read");
    this.name = "CalendarUnavailableError";
    this.cause = cause;
  }
}

/**
 * The open slots a member can actually pick from, right now, for one gym.
 *
 * Combines three busy sources into the one list openSlots() (the pure engine)
 * needs: the gym's own casdey bookings (always), and, when a Google
 * Calendar is connected, that calendar's free/busy for the same window. A
 * gym with no calendar connected still gets a working booking page: it
 * just cannot see bookings made outside casdey.
 */
export async function gymOpenSlots(
  gym: Gym,
  now: Date = new Date(),
): Promise<Interval[]> {
  const horizonEnd = new Date(
    now.getTime() + (gym.booking_horizon_days + 1) * 86_400_000,
  );

  const [{ data: existing }, googleBusy] = await Promise.all([
    supabaseAdmin()
      .from("bookings")
      .select("start_at, end_at")
      .eq("gym_id", gym.id)
      .eq("status", "booked")
      .lt("start_at", horizonEnd.toISOString())
      .gt("end_at", now.toISOString()),
    fetchGoogleBusy(gym, now, horizonEnd),
  ]);

  const busy: Interval[] = [
    ...(existing ?? []).map((row) => ({
      start: new Date(row.start_at as string),
      end: new Date(row.end_at as string),
    })),
    ...googleBusy,
  ];

  return openSlots(
    {
      hours: gym.booking_hours,
      timezone: gym.timezone,
      slotMinutes: gym.booking_slot_minutes,
      bufferMinutes: gym.booking_buffer_minutes,
      minNoticeHours: gym.booking_min_notice_hours,
      horizonDays: gym.booking_horizon_days,
    },
    busy,
    now,
  );
}

async function fetchGoogleBusy(
  gym: Gym,
  timeMin: Date,
  timeMax: Date,
): Promise<Interval[]> {
  const calendar = await calendarFor(gym.id);

  if (!calendar) {
    // Two cases look the same here (calendarFor returns null for both) but must
    // not be treated the same:
    //  - the gym never connected a calendar: casdey's own bookings are the
    //    whole truth, so no external busy times is correct → [].
    //  - the gym connected one and its token has since died: we would be
    //    silently ignoring the real diary → fail closed instead.
    if (await calendarNeedsReauth(gym.id)) {
      throw new CalendarUnavailableError();
    }
    return [];
  }

  try {
    return await calendar.getBusy(timeMin, timeMax);
  } catch (error) {
    // A connected calendar we cannot read (network, an API error, or a token
    // that just died mid-request) means we cannot verify the gym's diary. Do
    // not degrade to casdey-only, which would offer genuinely-busy slots as
    // free; fail closed and let the caller tell the member to reach out.
    console.error("[booking] google free/busy failed", error);
    throw new CalendarUnavailableError(error);
  }
}
