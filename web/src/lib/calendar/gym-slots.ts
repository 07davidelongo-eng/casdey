import "server-only";

import { supabaseAdmin } from "../supabase";
import type { Gym, Service } from "../types";
import { isExclusive, slotShape } from "../services";
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
type LiveBooking = {
  start_at: string;
  end_at: string;
  service_id: string | null;
  exclusive: boolean;
};

type BusyContext = { rows: LiveBooking[]; googleBusy: Interval[] };

/**
 * Everything that makes a time unavailable, read once.
 *
 * Pulled out because slots are now computed per service, and a gym offering
 * five bookable services would otherwise ask Google for its free/busy five
 * times to answer one page.
 */
async function loadBusy(gym: Gym, now: Date): Promise<BusyContext> {
  const horizonEnd = new Date(
    now.getTime() + (gym.booking_horizon_days + 1) * 86_400_000,
  );

  const [{ data }, googleBusy] = await Promise.all([
    supabaseAdmin()
      .from("bookings")
      .select("start_at, end_at, service_id, exclusive")
      .eq("gym_id", gym.id)
      .eq("status", "booked")
      .lt("start_at", horizonEnd.toISOString())
      .gt("end_at", now.toISOString()),
    fetchGoogleBusy(gym, now, horizonEnd),
  ]);

  return { rows: (data ?? []) as LiveBooking[], googleBusy };
}

function slotsFor(
  gym: Gym,
  busyContext: BusyContext,
  service: Service | null,
  now: Date,
): Interval[] {
  const shape = slotShape(service, {
    slotMinutes: gym.booking_slot_minutes,
    bufferMinutes: gym.booking_buffer_minutes,
  });
  const exclusive = isExclusive(service);

  // A class the member is trying to join is not a reason they cannot join it.
  // Every other live booking still blocks: another class needs the room, and
  // an exclusive booking needs the whole gym.
  const sameClass = (row: LiveBooking) =>
    !exclusive && !row.exclusive && row.service_id === (service?.id ?? null);

  const busy: Interval[] = [
    ...busyContext.rows
      .filter((row) => !sameClass(row))
      .map((row) => ({
        start: new Date(row.start_at),
        end: new Date(row.end_at),
      })),
    ...busyContext.googleBusy,
  ];

  const slots = openSlots(
    {
      hours: gym.booking_hours,
      timezone: gym.timezone,
      slotMinutes: shape.slotMinutes,
      bufferMinutes: shape.bufferMinutes,
      minNoticeHours: gym.booking_min_notice_hours,
      horizonDays: gym.booking_horizon_days,
    },
    busy,
    now,
  );

  if (exclusive) return slots;

  // A class slot closes when its places run out, not when it has anybody in
  // it at all.
  const capacity = service?.capacity ?? 1;
  const taken = seatsTaken(busyContext.rows, service?.id ?? null);

  return slots.filter(
    (slot) => (taken.get(slot.start.getTime()) ?? 0) < capacity,
  );
}

/** How many places are gone at each start time, for one service. */
export function seatsTaken(
  rows: LiveBooking[],
  serviceId: string | null,
): Map<number, number> {
  const taken = new Map<number, number>();
  for (const row of rows) {
    if (row.exclusive || row.service_id !== serviceId) continue;
    const at = new Date(row.start_at).getTime();
    taken.set(at, (taken.get(at) ?? 0) + 1);
  }
  return taken;
}

export async function gymOpenSlots(
  gym: Gym,
  now: Date = new Date(),
  service: Service | null = null,
): Promise<Interval[]> {
  return slotsFor(gym, await loadBusy(gym, now), service, now);
}

/**
 * Open slots for every bookable service at once, plus the generic list for a
 * gym that has not marked anything bookable.
 *
 * Keyed by service id, with null holding the generic list, so the member's
 * booking page can switch between services without a round trip and without
 * being offered a 30-minute PT time for a 60-minute class.
 */
export async function gymOpenSlotsByService(
  gym: Gym,
  services: Service[],
  now: Date = new Date(),
): Promise<{
  slots: Map<string | null, Interval[]>;
  seats: Map<string, Map<number, number>>;
}> {
  const busyContext = await loadBusy(gym, now);

  const slots = new Map<string | null, Interval[]>();
  const seats = new Map<string, Map<number, number>>();

  if (services.length === 0) {
    slots.set(null, slotsFor(gym, busyContext, null, now));
    return { slots, seats };
  }

  for (const service of services) {
    slots.set(service.id, slotsFor(gym, busyContext, service, now));
    if (!isExclusive(service)) {
      seats.set(service.id, seatsTaken(busyContext.rows, service.id));
    }
  }

  return { slots, seats };
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
