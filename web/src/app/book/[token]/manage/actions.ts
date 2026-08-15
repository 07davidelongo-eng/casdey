"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { calendarFor } from "@/lib/calendar/provider";

export type CancelState = { cancelled: boolean; error: string | null };

/**
 * Cancels a booking from the patient's own manage link.
 *
 * The appointment's own booking_token is the credential here, a different
 * token from the patient's own /book/[token] link: that one is stable and
 * reused for booking a new time, this one is per-appointment and sent only in
 * the confirmation, so an old confirmation email cannot be used to touch a
 * later booking.
 *
 * Reverting the patient's reactivated status is the part that matters most: a
 * cancelled appointment recovered no revenue, so it must stop counting toward
 * the dashboard's "rebooked" figure and the profit-or-nothing guarantee the
 * moment it is cancelled. It is only reverted when no other live booking
 * exists for the patient, so cancelling one of two appointments does not wipe
 * out a real rebooking that is still standing.
 */
export async function cancelAppointmentAction(
  _previous: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { cancelled: false, error: "That link is not valid." };

  const client = supabaseAdmin();

  const { data: appointment } = await client
    .from("appointments")
    .select("id, practice_id, patient_id, status, google_event_id")
    .eq("booking_token", token)
    .maybeSingle();

  if (!appointment) {
    return { cancelled: false, error: "That link is not valid." };
  }

  if (appointment.status !== "booked") {
    // Already cancelled, completed, or a no_show: nothing left to do, and not
    // an error either, the page below renders the right state for each.
    return { cancelled: appointment.status === "cancelled", error: null };
  }

  const { data: updated } = await client
    .from("appointments")
    // The status='booked' guard makes this safe against a double submit: the
    // second click's update simply matches zero rows.
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", appointment.id)
    .eq("status", "booked")
    .select("id")
    .maybeSingle();

  if (!updated) {
    return { cancelled: true, error: null }; // someone else's click won the race
  }

  if (appointment.google_event_id) {
    try {
      const calendar = await calendarFor(appointment.practice_id);
      if (calendar) await calendar.deleteEvent(appointment.google_event_id);
    } catch (error) {
      console.error("[booking] cancel: google delete failed", error);
    }
  }

  const { count: stillActive } = await client
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", appointment.patient_id)
    .neq("id", appointment.id)
    .in("status", ["booked", "completed"]);

  if (!stillActive) {
    await client
      .from("patients")
      .update({ status: "contacted" })
      .eq("id", appointment.patient_id)
      .eq("status", "reactivated");
  }

  await recordAudit({
    practiceId: appointment.practice_id,
    action: "appointment.cancelled",
    target: appointment.id,
  });

  return { cancelled: true, error: null };
}
