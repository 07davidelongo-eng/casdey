import "server-only";

import { supabaseAdmin } from "./supabase";
import { DEFAULT_REASONS, type ResolvedReason } from "./cancellation";

/**
 * The reasons this gym works with. All of them, and all of them the gym's own.
 *
 * casdey's six used to live in code, which made them impossible to rename or
 * delete (#33's design, and #46's complaint about it). They are now seeded as
 * rows the first time a gym looks at them, and from that moment they belong to
 * the gym: rename, reword, delete, add.
 *
 * The keys do not change during seeding, which is the whole reason this is
 * safe. A member recorded as 'price' months ago still points at the row the
 * gym now calls whatever it likes.
 *
 * Reads through the service role rather than the caller's session: this is
 * called from the send job, which has no session at all, and the gym id always
 * comes from a caller that has already checked one.
 */
export async function gymReasons(gymId: string): Promise<ResolvedReason[]> {
  const client = supabaseAdmin();

  const load = async () => {
    const { data, error } = await client
      .from("cancellation_reasons")
      .select("key, label, phrase")
      .eq("gym_id", gymId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      value: row.key as string,
      label: row.label as string,
      phrase: row.phrase as string,
    }));
  };

  try {
    const existing = await load();
    if (existing.length > 0) return existing;

    // Nothing there. Either this gym has never looked, or it deliberately
    // deleted every one. The marker on the gym row is what tells the two
    // apart, and it is why deleting them all sticks.
    const { data: gym } = await client
      .from("gyms")
      .select("reasons_initialised_at")
      .eq("id", gymId)
      .maybeSingle();

    if (gym?.reasons_initialised_at) return [];

    await client.from("cancellation_reasons").insert(
      DEFAULT_REASONS.map((reason, index) => ({
        gym_id: gymId,
        key: reason.value,
        label: reason.label,
        phrase: reason.phrase,
        position: index,
      })),
    );

    await client
      .from("gyms")
      .update({ reasons_initialised_at: new Date().toISOString() })
      .eq("id", gymId);

    return await load();
  } catch (error) {
    // Never fatal. A campaign must still send when this cannot be read, and
    // phraseForReason falls back to casdey's own gentle wording, so the worst
    // case is a message that says "it being a while" instead of naming the
    // reason. Returning the defaults keeps every picker usable meanwhile.
    console.error(
      "[reasons] load failed",
      error instanceof Error ? error.message : error,
    );
    return DEFAULT_REASONS;
  }
}
