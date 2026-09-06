"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { OFFERS } from "@/lib/offers/library";
import { deadlineFrom, renderOffer } from "@/lib/offers/select";
import type { OfferInputs } from "@/lib/offers/types";
import { CANCELLATION_REASONS } from "@/lib/cancellation";

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
