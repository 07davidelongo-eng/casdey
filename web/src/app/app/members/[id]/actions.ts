"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireGym } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { isCancellationReason } from "@/lib/cancellation";

export type MemberActionState = { error: string | null };

/**
 * Records that a member formally cancelled, and why.
 *
 * A stronger, more immediate signal than waiting for last_visit_at to cross
 * the lapse cutoff on its own, which can be nearly a year away (see
 * buildAudience in src/lib/campaigns.ts). Deliberately does not touch
 * status: this is metadata about why someone left, not a change to the
 * active/contacted/returned/opted_out lifecycle.
 */
export async function markCancelledAction(
  _previous: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const { gym, session } = await requireGym();
  const memberId = String(formData.get("memberId") ?? "");
  const reason = formData.get("reason");
  if (!memberId) return { error: "Missing member." };
  if (!isCancellationReason(reason)) {
    return { error: "Pick a reason before saving." };
  }

  const now = new Date().toISOString();
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("members")
    .update({ cancellation_reason: reason, cancelled_at: now })
    .eq("id", memberId)
    .eq("gym_id", gym.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[member] cancel failed", error?.message);
    return { error: "We could not save that. Try again." };
  }

  await client.from("member_events").insert({
    gym_id: gym.id,
    member_id: memberId,
    type: "cancelled",
    meta: { reason, recorded_by: session.email },
  });

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "member.cancelled",
    target: memberId,
    meta: { reason },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}

/**
 * Records that a member booked again.
 *
 * Manual on purpose. casdey sends the message, but the booking happens in the
 * gym's own diary, which casdey cannot see. Inferring a return from a
 * reply would mean inventing a number, and the brand rule on that is absolute:
 * if it is not real, it does not go on the page.
 */
export async function markReturnedAction(
  _previous: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const { gym, session } = await requireGym();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member." };

  const now = new Date().toISOString();
  const client = supabaseAdmin();

  // gym_id in the filter is what stops one gym writing to another's
  // member by posting a guessed id.
  const { data, error } = await client
    .from("members")
    .update({ status: "returned", returned_at: now })
    .eq("id", memberId)
    .eq("gym_id", gym.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[member] return failed", error?.message);
    return { error: "We could not save that. Try again." };
  }

  await client.from("member_events").insert({
    gym_id: gym.id,
    member_id: memberId,
    type: "returned",
    meta: { recorded_by: session.email },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}

/**
 * Undoes a manually-recorded return.
 *
 * Staff can mis-click, or a member who was marked returned can tell the gym
 * they are not actually coming back after all. Left alone, that mistake sits
 * in the returned count and in the profit-or-nothing guarantee's revenue
 * figure forever, since there was previously no way back from
 * markReturnedAction. Mirrors the guard cancelBookingAction already applies
 * from the other direction (src/app/book/[token]/manage/actions.ts): a
 * member with a live self-serve booking is not reverted here, since that
 * booking is real evidence they are coming back and the member's own manage
 * link is the correct place to cancel it, not this page.
 */
export async function unmarkReturnedAction(
  _previous: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const { gym, session } = await requireGym();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member." };

  const client = supabaseAdmin();

  const { count: liveBooking } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .in("status", ["booked", "completed"]);

  if (liveBooking) {
    return {
      error:
        "This member has a booking on record. Cancel that from their booking confirmation to undo the return.",
    };
  }

  const { data, error } = await client
    .from("members")
    .update({ status: "contacted" })
    .eq("id", memberId)
    .eq("gym_id", gym.id)
    .eq("status", "returned")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[member] undo return failed", error?.message);
    return { error: "We could not save that. Try again." };
  }

  await client.from("member_events").insert({
    gym_id: gym.id,
    member_id: memberId,
    type: "return_undone",
    meta: { recorded_by: session.email },
  });

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "member.return_undone",
    target: memberId,
  });

  revalidatePath("/app", "layout");
  return { error: null };
}

/**
 * Erasure. Actually deletes, and cannot be undone.
 *
 * The suppression row is written first and deliberately survives: forgetting
 * that somebody asked us to stop, and then emailing them again after a
 * re-import, is the one mistake that turns a deletion request into a second
 * complaint.
 */
export async function deleteMemberAction(
  _previous: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const { gym, session } = await requireGym();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member." };

  const client = supabaseAdmin();

  const { data: member } = await client
    .from("members")
    .select("email")
    .eq("id", memberId)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (member?.email) {
    await client.from("suppressions").upsert(
      {
        gym_id: gym.id,
        email: member.email,
        reason: "manual",
      },
      { onConflict: "gym_id,email" },
    );
  }

  const { error } = await client
    .from("members")
    .delete()
    .eq("id", memberId)
    .eq("gym_id", gym.id);

  if (error) {
    console.error("[member] delete failed", error.message);
    return { error: "We could not delete that record. Try again." };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "member.deleted",
    target: memberId,
  });

  revalidatePath("/app", "layout");
  redirect("/app/members?deleted=1");
}
