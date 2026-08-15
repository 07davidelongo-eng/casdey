import "server-only";

import { supabaseAdmin } from "../supabase";
import type { Practice } from "../types";
import { openSlots, type Interval } from "./availability";
import { calendarFor } from "./provider";

/**
 * The open slots a patient can actually pick from, right now, for one practice.
 *
 * Combines three busy sources into the one list openSlots() (the pure engine)
 * needs: the practice's own casdey appointments (always), and, when a Google
 * Calendar is connected, that calendar's free/busy for the same window. A
 * practice with no calendar connected still gets a working booking page: it
 * just cannot see appointments made outside casdey.
 */
export async function practiceOpenSlots(
  practice: Practice,
  now: Date = new Date(),
): Promise<Interval[]> {
  const horizonEnd = new Date(
    now.getTime() + (practice.booking_horizon_days + 1) * 86_400_000,
  );

  const [{ data: existing }, googleBusy] = await Promise.all([
    supabaseAdmin()
      .from("appointments")
      .select("start_at, end_at")
      .eq("practice_id", practice.id)
      .eq("status", "booked")
      .lt("start_at", horizonEnd.toISOString())
      .gt("end_at", now.toISOString()),
    fetchGoogleBusy(practice, now, horizonEnd),
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
      hours: practice.booking_hours,
      timezone: practice.timezone,
      slotMinutes: practice.booking_slot_minutes,
      bufferMinutes: practice.booking_buffer_minutes,
      minNoticeHours: practice.booking_min_notice_hours,
      horizonDays: practice.booking_horizon_days,
    },
    busy,
    now,
  );
}

async function fetchGoogleBusy(
  practice: Practice,
  timeMin: Date,
  timeMax: Date,
): Promise<Interval[]> {
  try {
    const calendar = await calendarFor(practice.id);
    if (!calendar) return [];
    return await calendar.getBusy(timeMin, timeMax);
  } catch (error) {
    // A stale/expired Google connection must not take the booking page down;
    // it degrades to casdey's own appointments only, same as no connection.
    console.error("[booking] google free/busy failed", error);
    return [];
  }
}
