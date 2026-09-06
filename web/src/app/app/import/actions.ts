"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type AgreementState = { error: string | null };

/**
 * Records that the gym has confirmed it is the data controller for the
 * members it is about to upload, and that it has a lawful basis to contact
 * them.
 *
 * This gate is the reason /api/import refuses to accept a file until it is set.
 * casdey processes this data on the gym's instructions; without the
 * gym saying so, we are processing health-adjacent personal data on no
 * stated basis at all.
 */
export async function agreeToProcessingAction(
  _previous: AgreementState,
  formData: FormData,
): Promise<AgreementState> {
  const { gym, session } = await requireOwner();

  if (formData.get("confirm") !== "yes") {
    return { error: "Tick the box to confirm before importing members." };
  }

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      processing_agreed_at: new Date().toISOString(),
      processing_agreed_by: session.userId,
    })
    .eq("id", gym.id);

  if (error) {
    console.error("[import] agreement failed", error.message);
    return { error: "We could not record that. Try again." };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "processing.agreed",
  });

  revalidatePath("/app/import");
  return { error: null };
}

export type UndoImportState = { error: string | null; message: string | null };

/**
 * Undo an import, as far as an import can honestly be undone.
 *
 * What this removes: the members that import created and that nothing has
 * happened to since. Nothing else, and the limits are the point rather than
 * missing work.
 *
 * It cannot restore what an import overwrote. An import updates a member's
 * last visit and visit count in place and casdey does not keep the previous
 * values, so a member who existed before is left exactly as the import left
 * them. Pretending otherwise would be worse than saying it.
 *
 * It will not remove a member casdey has written to, or who has come back, or
 * who has a booking. Deleting them would erase the record of a message sent in
 * the gym's name to a real person, and on Pro it would quietly change the
 * numbers a guarantee is judged against. Those members stay, and the gym is
 * told how many were kept and why.
 *
 * The import row itself is kept either way. It is the history of what was
 * done, and this action adds to that history rather than hiding it.
 */
export async function undoImportAction(
  _previous: UndoImportState,
  formData: FormData,
): Promise<UndoImportState> {
  const { gym, session } = await requireOwner();
  const importId = String(formData.get("importId") ?? "");

  const client = supabaseAdmin();

  const { data: run } = await client
    .from("imports")
    .select("id, filename, source")
    .eq("id", importId)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (!run) {
    return { error: "That import is not in your history.", message: null };
  }

  // Which members this import created. Written by recordImportEvents at the
  // time, which is the only record of it: members carry no import id of their
  // own, deliberately, since a member can be touched by many imports.
  const { data: events, error: eventsError } = await client
    .from("member_events")
    .select("member_id")
    .eq("gym_id", gym.id)
    .eq("type", "imported")
    .eq("meta->>import_id", importId);

  if (eventsError) {
    console.error("[import] undo lookup failed", eventsError.message);
    return { error: "We could not read that import. Try again.", message: null };
  }

  const createdIds = [...new Set((events ?? []).map((e) => e.member_id as string))];

  if (createdIds.length === 0) {
    return {
      error: null,
      message:
        "That import added no new members, so there is nothing to undo. Members it updated keep the values it wrote.",
    };
  }

  // Anyone casdey has already dealt with is off limits. Checked here rather
  // than trusted to a status alone, because a member can have a booking while
  // still reading as active.
  const { data: candidates } = await client
    .from("members")
    .select("id, status, contacted_at")
    .eq("gym_id", gym.id)
    .in("id", createdIds);

  const { data: booked } = await client
    .from("bookings")
    .select("member_id")
    .eq("gym_id", gym.id)
    .in("member_id", createdIds);

  const hasBooking = new Set((booked ?? []).map((b) => b.member_id as string));

  const removable = (candidates ?? [])
    .filter(
      (m) =>
        m.status === "active" &&
        m.contacted_at === null &&
        !hasBooking.has(m.id as string),
    )
    .map((m) => m.id as string);

  const kept = createdIds.length - removable.length;

  if (removable.length > 0) {
    const { error } = await client
      .from("members")
      .delete()
      .eq("gym_id", gym.id)
      .in("id", removable);

    if (error) {
      console.error("[import] undo delete failed", error.message);
      return { error: "We could not undo that import. Try again.", message: null };
    }
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "import.undone",
    target: importId,
    meta: { removed: removable.length, kept, file: run.filename ?? run.source },
  });

  revalidatePath("/app/import");
  revalidatePath("/app", "layout");

  return {
    error: null,
    message:
      kept > 0
        ? `Removed ${removable.length} ${removable.length === 1 ? "member" : "members"}. ${kept} ${kept === 1 ? "was" : "were"} kept because casdey has already written to them, they came back, or they have a booking.`
        : `Removed ${removable.length} ${removable.length === 1 ? "member" : "members"} that import added. Members it updated keep the values it wrote.`,
  };
}
