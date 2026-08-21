"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { calendarFor } from "@/lib/calendar/provider";

export type CancelState = { cancelled: boolean; error: string | null };

/**
 * Cancels a booking from the member's own manage link.
 *
 * The booking's own booking_token is the credential here, a different
 * token from the member's own /book/[token] link: that one is stable and
 * reused for booking a new time, this one is per-booking and sent only in
 * the confirmation, so an old confirmation email cannot be used to touch a
 * later booking.
 *
 * Reverting the member's returned status is the part that matters most: a
 * cancelled booking recovered no revenue, so it must stop counting toward
 * the dashboard's "returned" figure and the profit-or-nothing guarantee the
 * moment it is cancelled. It is only reverted when no other live booking
 * exists for the member, so cancelling one of two bookings does not wipe
 * out a real return that is still standing.
 */
export async function cancelBookingAction(
  _previous: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { cancelled: false, error: "That link is not valid." };

  const client = supabaseAdmin();

  const { data: booking } = await client
    .from("bookings")
    .select("id, gym_id, member_id, status, google_event_id")
    .eq("booking_token", token)
    .maybeSingle();

  if (!booking) {
    return { cancelled: false, error: "That link is not valid." };
  }

  if (booking.status !== "booked") {
    // Already cancelled, completed, or a no_show: nothing left to do, and not
    // an error either, the page below renders the right state for each.
    return { cancelled: booking.status === "cancelled", error: null };
  }

  const { data: updated } = await client
    .from("bookings")
    // The status='booked' guard makes this safe against a double submit: the
    // second click's update simply matches zero rows.
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("status", "booked")
    .select("id")
    .maybeSingle();

  if (!updated) {
    return { cancelled: true, error: null }; // someone else's click won the race
  }

  if (booking.google_event_id) {
    try {
      const calendar = await calendarFor(booking.gym_id);
      if (calendar) await calendar.deleteEvent(booking.google_event_id);
    } catch (error) {
      console.error("[booking] cancel: google delete failed", error);
    }
  }

  const { count: stillActive } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("member_id", booking.member_id)
    .neq("id", booking.id)
    .in("status", ["booked", "completed"]);

  if (!stillActive) {
    await client
      .from("members")
      .update({ status: "contacted" })
      .eq("id", booking.member_id)
      .eq("status", "returned");
  }

  await recordAudit({
    gymId: booking.gym_id,
    action: "booking.cancelled",
    target: booking.id,
  });

  return { cancelled: true, error: null };
}
