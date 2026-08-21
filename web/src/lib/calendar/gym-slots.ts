import "server-only";

import { supabaseAdmin } from "../supabase";
import type { Gym } from "../types";
import { openSlots, type Interval } from "./availability";
import { calendarFor } from "./provider";

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
  try {
    const calendar = await calendarFor(gym.id);
    if (!calendar) return [];
    return await calendar.getBusy(timeMin, timeMax);
  } catch (error) {
    // A stale/expired Google connection must not take the booking page down;
    // it degrades to casdey's own bookings only, same as no connection.
    console.error("[booking] google free/busy failed", error);
    return [];
  }
}
