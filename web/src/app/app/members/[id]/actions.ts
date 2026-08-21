"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireGym } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type MemberActionState = { error: string | null };

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
