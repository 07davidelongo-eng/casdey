"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import type { BookingHours, Weekday } from "@/lib/types";

export type BookingSettingsState = { error: string | null; saved: boolean };

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const Schema = z.object({
  enabled: z.boolean(),
  slotMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  minNoticeHours: z.coerce.number().int().min(0).max(720),
  horizonDays: z.coerce.number().int().min(1).max(120),
});

/**
 * Saves a practice's booking configuration: the on/off switch, the slot shape,
 * and the weekly hours. One open window per weekday for now (the schema stores
 * an array, so a lunch-break split can be added later without a migration).
 *
 * Times are validated here so the availability engine never has to defend
 * against a malformed window: an open day with a missing or backwards time is
 * rejected with a clear message rather than silently dropped.
 */
export async function saveBookingSettingsAction(
  _previous: BookingSettingsState,
  formData: FormData,
): Promise<BookingSettingsState> {
  const { practice, session } = await requireOwner();

  const parsed = Schema.safeParse({
    enabled: formData.get("enabled") === "on",
    slotMinutes: formData.get("slotMinutes"),
    bufferMinutes: formData.get("bufferMinutes"),
    minNoticeHours: formData.get("minNoticeHours"),
    horizonDays: formData.get("horizonDays"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the numbers.",
      saved: false,
    };
  }

  const hours: BookingHours = {};
  for (const day of WEEKDAYS) {
    if (formData.get(`${day}_open`) !== "on") continue;
    const start = String(formData.get(`${day}_start`) ?? "").trim();
    const end = String(formData.get(`${day}_end`) ?? "").trim();
    if (!HHMM.test(start) || !HHMM.test(end)) {
      return { error: `Add valid open and close times for ${dayLabel(day)}.`, saved: false };
    }
    if (start >= end) {
      return { error: `${dayLabel(day)} closes before it opens.`, saved: false };
    }
    hours[day] = [[start, end]];
  }

  if (parsed.data.enabled && Object.keys(hours).length === 0) {
    return {
      error: "Set your open hours for at least one day before turning booking on.",
      saved: false,
    };
  }

  const { error } = await supabaseAdmin()
    .from("practices")
    .update({
      booking_enabled: parsed.data.enabled,
      booking_slot_minutes: parsed.data.slotMinutes,
      booking_buffer_minutes: parsed.data.bufferMinutes,
      booking_min_notice_hours: parsed.data.minNoticeHours,
      booking_horizon_days: parsed.data.horizonDays,
      booking_hours: hours,
    })
    .eq("id", practice.id);

  if (error) {
    console.error("[booking settings] update failed", error.message);
    return { error: "We could not save that. Try again.", saved: false };
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "booking.settings_updated",
    meta: { enabled: parsed.data.enabled, days: Object.keys(hours) },
  });

  revalidatePath("/app", "layout");
  return { error: null, saved: true };
}

function dayLabel(day: Weekday): string {
  return {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  }[day];
}
