"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { OFFERS } from "@/lib/offers/library";
import { deadlineFrom, renderOffer } from "@/lib/offers/select";
import type { OfferInputs } from "@/lib/offers/types";
import {
  CANCELLATION_REASONS,
  isCancellationReason,
  REASON_KEY_PATTERN,
  reasonKeyFrom,
} from "@/lib/cancellation";

export type OfferState = { error: string | null; message: string | null };

/**
 * Saves the offer a gym picked.
 *
 * The rendered text is stored, not just the library id. The library will change
 * as casdey learns which offers work, and a member who was promised two free
 * weeks must never open a booking page describing something else. Rendering at
 * send time would let a later edit rewrite history.
 */
export async function chooseOfferAction(
  _previous: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const { gym, session } = await requireOwner();

  const offerId = String(formData.get("offerId") ?? "");
  const offer = OFFERS.find((o) => o.id === offerId);
  if (!offer) {
    return { error: "That offer is no longer available. Pick another.", message: null };
  }

  let inputs: OfferInputs | null = null;
  try {
    inputs = JSON.parse(String(formData.get("inputs") ?? "null")) as OfferInputs;
  } catch {
    inputs = null;
  }

  const days = inputs?.deadlineDays ?? 14;
  const expiresAt = offer.dated ? deadlineFrom(new Date(), days) : null;

  // What the gym wrote wins, always. casdey's wording is a suggestion, and a
  // gym that wants a quarter off one month rather than half off two knows its
  // own margin better than a library does. Falling back to ours only when the
  // box came back empty.
  const edited = String(formData.get("text") ?? "").trim();
  const suggested = offer.dated
    ? renderOffer(offer, expiresAt as Date)
    : offer.memberFacing;
  const text = edited || suggested;

  if (text.length > 600) {
    return {
      error: "That is longer than an offer should be. Keep it under 600 characters.",
      message: null,
    };
  }

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      offer_id: offer.id,
      offer_text: text,
      offer_expires_at: expiresAt ? expiresAt.toISOString() : null,
      offer_inputs: inputs,
      offer_chosen_at: new Date().toISOString(),
    })
    .eq("id", gym.id);

  if (error) {
    console.error("[offer] save failed", error.message);
    return { error: "We could not save that. Try again.", message: null };
  }

  await rememberOffer(gym.id, {
    name: offer.name,
    body: text,
    expiresAt,
    libraryId: offer.id,
  });

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "offer.chosen",
    meta: { offerId: offer.id },
  });

  revalidatePath("/app/offer");
  revalidatePath("/app/campaigns/new");
  return {
    error: null,
    message: "Offer saved. Your next campaign will carry it.",
  };
}

/** Removes the offer, so campaigns go back to a plain check-in. */
export async function clearOfferAction(): Promise<OfferState> {
  const { gym, session } = await requireOwner();

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      offer_id: null,
      offer_text: null,
      offer_expires_at: null,
      offer_inputs: null,
      offer_chosen_at: null,
    })
    .eq("id", gym.id);

  if (error) {
    return { error: "We could not clear that. Try again.", message: null };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "offer.cleared",
  });

  revalidatePath("/app/offer");
  return { error: null, message: "Offer removed." };
}

/**
 * The gym's own offer, in their own words.
 *
 * casdey's library is a starting point, not a ceiling. A gym that already
 * knows what brings its members back does not need to answer five questions
 * to be allowed to type it, and forcing them through the builder to reach a
 * text box is the kind of thing that makes people close the tab.
 */
export async function writeOwnOfferAction(
  _previous: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const { gym, session } = await requireOwner();

  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 10) {
    return {
      error: "Write the offer as a member would read it.",
      message: null,
    };
  }
  if (text.length > 600) {
    return {
      error: "That is longer than an offer should be. Keep it under 600 characters.",
      message: null,
    };
  }

  const rawDays = Number(formData.get("deadlineDays") ?? "");
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.round(rawDays) : null;
  const expiresAt = days ? deadlineFrom(new Date(), days) : null;

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      // No library id: nothing generated this, so there is nothing to
      // attribute it to or to reorder later by how well it did.
      offer_id: null,
      offer_text: text,
      offer_expires_at: expiresAt ? expiresAt.toISOString() : null,
      offer_inputs: null,
      offer_chosen_at: new Date().toISOString(),
    })
    .eq("id", gym.id);

  if (error) {
    console.error("[offer] custom save failed", error.message);
    return { error: "We could not save that. Try again.", message: null };
  }

  await rememberOffer(gym.id, {
    // Named from its own first words, so a list of six offers is readable
    // without asking the gym to name each one as it writes it.
    name: text.length > 42 ? `${text.slice(0, 42).trim()}...` : text,
    body: text,
    expiresAt,
    libraryId: null,
  });

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "offer.chosen",
    meta: { offerId: "custom" },
  });

  revalidatePath("/app/offer");
  revalidatePath("/app/campaigns/new");
  return { error: null, message: "Offer saved. Your next campaign will carry it." };
}

/**
 * A different offer for a different reason for leaving.
 *
 * Saved as one map rather than one row per reason, so a gym editing three of
 * them at once cannot end up half saved. An empty box means "no variant for
 * this reason", which falls back to the gym's general offer rather than
 * meaning "send them nothing".
 */
export async function saveOfferVariantsAction(
  _previous: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const { gym, session } = await requireOwner();

  const variants: Record<string, { text: string; expiresAt: null; offerId: null }> = {};
  for (const reason of CANCELLATION_REASONS) {
    const text = String(formData.get(`variant-${reason}`) ?? "").trim();
    if (!text) continue;
    if (text.length > 600) {
      return {
        error: `The ${reason.replace("_", " ")} offer is longer than 600 characters.`,
        message: null,
      };
    }
    variants[reason] = { text, expiresAt: null, offerId: null };
  }

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({ offer_variants: variants })
    .eq("id", gym.id);

  if (error) {
    console.error("[offer] variants save failed", error.message);
    return { error: "We could not save those. Try again.", message: null };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "offer.chosen",
    meta: { variants: Object.keys(variants) },
  });

  revalidatePath("/app/offer");
  revalidatePath("/app/campaigns/new");
  return {
    error: null,
    message:
      Object.keys(variants).length > 0
        ? "Saved. Members you have a reason on file for get the offer written for it."
        : "Saved. Everyone gets your general offer.",
  };
}

/**
 * The gym's saved offers.
 *
 * Every offer a gym commits to, whether picked from the library or written
 * from scratch, is kept here as well as being put in use. Choosing a new one
 * used to overwrite the old one with no way back, which made trying a
 * different angle a decision to destroy the previous wording.
 *
 * Saved on the way through rather than by an explicit "save" button, because
 * an offer a gym thought was worth sending is worth keeping, and asking them
 * to press a second button to keep their own work is how work gets lost.
 */
export async function rememberOffer(
  gymId: string,
  offer: { name: string; body: string; expiresAt: Date | null; libraryId: string | null },
): Promise<void> {
  const client = supabaseAdmin();

  // Saving the identical wording twice adds nothing and clutters the list.
  const { data: existing } = await client
    .from("gym_offers")
    .select("id")
    .eq("gym_id", gymId)
    .eq("body", offer.body)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { error } = await client.from("gym_offers").insert({
    gym_id: gymId,
    name: offer.name,
    body: offer.body,
    expires_at: offer.expiresAt ? offer.expiresAt.toISOString().slice(0, 10) : null,
    library_id: offer.libraryId,
  });

  // Never fatal. The offer the gym just chose is already saved on the gym row,
  // which is what actually sends; failing to file a copy must not look like a
  // failure to save the offer.
  if (error) console.error("[offer] library save failed", error.message);
}

/** Put a saved offer back into use as the gym's general offer. */
export async function useSavedOfferAction(
  _previous: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const { gym, session } = await requireOwner();
  const id = String(formData.get("offerId") ?? "");

  const client = supabaseAdmin();
  const { data: saved } = await client
    .from("gym_offers")
    .select("id, name, body, expires_at, library_id")
    .eq("id", id)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (!saved) {
    return { error: "That offer is no longer in your list.", message: null };
  }

  const { error } = await client
    .from("gyms")
    .update({
      offer_id: saved.library_id,
      offer_text: saved.body,
      offer_expires_at: saved.expires_at,
      offer_chosen_at: new Date().toISOString(),
    })
    .eq("id", gym.id);

  if (error) {
    console.error("[offer] use saved failed", error.message);
    return { error: "We could not switch to that offer. Try again.", message: null };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "offer.chosen",
    meta: { from: "library", savedOfferId: saved.id },
  });

  revalidatePath("/app/offer");
  revalidatePath("/app/campaigns/new");
  return { error: null, message: `"${saved.name}" is now your general offer.` };
}

/**
 * Delete a saved offer.
 *
 * Deleting the one currently in use is allowed and does NOT stop it being
 * sent: gyms.offer_text is a copy, not a reference, for exactly the reason
 * this whole file keeps repeating, which is that a member promised something
 * keeps being promised it. So this removes it from the list and says plainly
 * that the offer still in use has not changed.
 */
export async function deleteSavedOfferAction(
  _previous: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const { gym, session } = await requireOwner();
  const id = String(formData.get("offerId") ?? "");

  const client = supabaseAdmin();
  const { data, error } = await client
    .from("gym_offers")
    .delete()
    .eq("id", id)
    .eq("gym_id", gym.id)
    .select("id, name, body");

  if (error) {
    console.error("[offer] delete failed", error.message);
    return { error: "We could not delete that. Try again.", message: null };
  }

  if (!data || data.length === 0) {
    return { error: "That offer is no longer in your list.", message: null };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "offer.cleared",
    meta: { deletedSavedOffer: data[0].name },
  });

  const stillInUse = data[0].body === gym.offer_text;

  revalidatePath("/app/offer");
  return {
    error: null,
    message: stillInUse
      ? "Deleted from your list. It is still your general offer, and members already promised it keep it."
      : "Offer deleted.",
  };
}

/**
 * A gym's own reasons for members leaving (#33).
 *
 * casdey's six are a guess at what a gym hears at the front desk. A gym that
 * knows its members leave because a creche closed, or because shifts changed,
 * needs to be able to say so, because "Something else" is a bucket no offer can
 * be written for.
 *
 * Saved as a whole list rather than row by row, same as the offer variants: a
 * gym editing three of them at once presses save once.
 */
export async function saveReasonsAction(
  _previous: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const { gym, session } = await requireOwner();

  let rows: { key: string; label: string; phrase: string }[] = [];
  try {
    const raw = JSON.parse(String(formData.get("reasons") ?? "[]"));
    if (!Array.isArray(raw)) throw new Error("not a list");
    rows = raw
      .map((row) => ({
        key: String(row?.key ?? "").trim(),
        label: String(row?.label ?? "").trim(),
        phrase: String(row?.phrase ?? "").trim(),
      }))
      .filter((row) => row.label.length > 0);
  } catch {
    return { error: "We could not read that. Try again.", message: null };
  }

  for (const row of rows) {
    if (!row.key) row.key = reasonKeyFrom(row.label);
    if (!REASON_KEY_PATTERN.test(row.key)) {
      return {
        error: `"${row.label}" needs at least a couple of letters casdey can turn into a name.`,
        message: null,
      };
    }
    if (row.label.length > 60) {
      return { error: "Keep a reason under 60 characters.", message: null };
    }
    // The phrase is what a member reads, so it cannot be left to chance. Where
    // the gym has not written one, build a serviceable sentence from the label
    // rather than refusing to save.
    if (!row.phrase) row.phrase = row.label.toLowerCase();
    if (row.phrase.length > 80) {
      return { error: "Keep the member-facing wording under 80 characters.", message: null };
    }
    if (isCancellationReason(row.key)) {
      return {
        error: `"${row.label}" is already one of casdey's own reasons. Give yours a different name.`,
        message: null,
      };
    }
  }

  const keys = rows.map((r) => r.key);
  if (new Set(keys).size !== keys.length) {
    return { error: "Two of those reasons come out with the same name.", message: null };
  }

  const client = supabaseAdmin();

  // Anything the gym removed from the list. Members already tagged with it keep
  // the tag: deleting the reason must not quietly rewrite a member's history,
  // and phraseForReason falls back to the gentle catch-all so nothing broken
  // ever reaches a member.
  const { data: existing } = await client
    .from("cancellation_reasons")
    .select("id, key")
    .eq("gym_id", gym.id);

  const gone = (existing ?? [])
    .filter((row) => !keys.includes(row.key as string))
    .map((row) => row.id as string);

  if (gone.length > 0) {
    await client.from("cancellation_reasons").delete().in("id", gone);
  }

  if (rows.length > 0) {
    const { error } = await client.from("cancellation_reasons").upsert(
      rows.map((row, index) => ({
        gym_id: gym.id,
        key: row.key,
        label: row.label,
        phrase: row.phrase,
        position: index,
      })),
      { onConflict: "gym_id,key" },
    );

    if (error) {
      console.error("[reasons] save failed", error.message);
      return { error: "We could not save those. Try again.", message: null };
    }
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "gym.updated",
    meta: { reasons: rows.length, removed: gone.length },
  });

  revalidatePath("/app/offer");
  revalidatePath("/app/members", "layout");
  revalidatePath("/app/campaigns/new");
  return { error: null, message: "Your reasons are saved." };
}
