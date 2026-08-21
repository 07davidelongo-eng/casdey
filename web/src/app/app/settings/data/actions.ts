"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type PurgeState = { error: string | null; purged: number | null };

/**
 * Deletes every member this gym has given casdey.
 *
 * Real deletion, not a flag. Member events and queued messages go with them by
 * foreign key cascade, so nothing is left holding a name or an address.
 *
 * Guarded by typing the gym name rather than a checkbox: this is the one
 * action in the app that destroys a customer's data outright, and it should be
 * impossible to do by mis-clicking.
 *
 * Suppressions are kept on purpose. They hold an email address and nothing
 * else, and dropping them would mean somebody who unsubscribed could be
 * emailed again after the next import. That is the outcome the rule exists to
 * prevent, and it outweighs deleting one more row.
 */
export async function purgeMembersAction(
  _previous: PurgeState,
  formData: FormData,
): Promise<PurgeState> {
  const { gym, session } = await requireOwner();

  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed.toLowerCase() !== gym.name.trim().toLowerCase()) {
    return {
      error: "That does not match your gym name, so nothing was deleted.",
      purged: null,
    };
  }

  const client = supabaseAdmin();

  const { count } = await client
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gym.id);

  const { error } = await client
    .from("members")
    .delete()
    .eq("gym_id", gym.id);

  if (error) {
    console.error("[purge] failed", error.message);
    return { error: "The deletion did not complete. Try again.", purged: null };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "members.purged",
    meta: { rows: count ?? 0 },
  });

  revalidatePath("/app", "layout");
  return { error: null, purged: count ?? 0 };
}
