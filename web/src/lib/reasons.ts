import "server-only";

import { supabaseAdmin } from "./supabase";
import {
  resolveReasons,
  type CustomReason,
  type ResolvedReason,
} from "./cancellation";

/**
 * The reasons this gym works with: casdey's six, plus its own (#33).
 *
 * One place to load them, because the alternative is every screen deciding for
 * itself whether to bother, and a screen that does not bother shows a member
 * tagged "childcare" as a raw slug or, worse, sends it to them.
 *
 * Reads through the service role rather than the caller's session: this is
 * called from the send job, which has no session at all, and the gym id always
 * comes from a caller that has already checked one.
 */
export async function gymReasons(gymId: string): Promise<ResolvedReason[]> {
  const { data, error } = await supabaseAdmin()
    .from("cancellation_reasons")
    .select("key, label, phrase")
    .eq("gym_id", gymId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    // Never fatal. The six built-ins are a complete, working set, and a gym
    // whose custom reasons could not be read should still get its campaign
    // sent rather than an error page.
    console.error("[reasons] load failed", error.message);
    return resolveReasons([]);
  }

  return resolveReasons((data ?? []) as CustomReason[]);
}
