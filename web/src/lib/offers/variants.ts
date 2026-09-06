import { REASON_KEY_PATTERN, type CancellationReason } from "../cancellation";
import type { LapseReason } from "./types";

/**
 * A different offer for a different reason for leaving.
 *
 * The builder produced one line of text for every lapsed member, which assumes
 * they all left for the same reason. They did not. Somebody who left because
 * it was expensive and somebody who left because they hurt their shoulder need
 * opposite things said to them, and one discount sent to both wastes margin on
 * the first and misses the second entirely.
 *
 * The gym's single offer stays as the default. A variant only exists where the
 * gym wrote one, and a member with no reason on file gets the default, which
 * is the common case and has to keep working untouched.
 */

export type OfferVariant = {
  text: string;
  /** ISO date, or null for an offer that makes no promise to expire. */
  expiresAt: string | null;
  /** Library id, or null when the gym wrote it themselves. */
  offerId: string | null;
};

/**
 * Keyed by reason. Not by CancellationReason any more: since #33 a gym can add
 * its own reasons, and a variant map that only understood the six built-ins
 * would silently drop the offer written for the reason the gym cared enough to
 * invent.
 */
export type OfferVariants = Record<string, OfferVariant>;

/** jsonb, so it is not to be trusted to have any particular shape. */
export function parseVariants(value: unknown): OfferVariants {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const out: OfferVariants = {};

  // Read whatever keys are there, rather than looking for a fixed six. Guarded
  // by the same shape rule the database enforces, so a malformed jsonb blob
  // cannot introduce a key nothing else in the app would recognise.
  for (const reason of Object.keys(source)) {
    if (!REASON_KEY_PATTERN.test(reason)) continue;
    const raw = source[reason];
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const text = typeof entry.text === "string" ? entry.text.trim() : "";
    if (!text) continue;
    out[reason] = {
      text,
      expiresAt:
        typeof entry.expiresAt === "string" && entry.expiresAt
          ? entry.expiresAt
          : null,
      offerId: typeof entry.offerId === "string" ? entry.offerId : null,
    };
  }

  return out;
}

/**
 * The offer this particular member should be shown.
 *
 * Order matters: the reason-specific offer wins, then the gym's default, then
 * nothing at all. Nothing is a real answer, not a failure. A campaign with no
 * offer is a plain check-in, which is the right message for a gym that has not
 * decided what it can afford to give away yet.
 */
export function offerForMember(
  variants: OfferVariants,
  fallback: string | null,
  reason: string | null,
): string | null {
  if (reason && variants[reason]) return variants[reason].text;
  return fallback ?? null;
}

/**
 * The two vocabularies for why somebody left, reconciled.
 *
 * members.cancellation_reason is what staff record at the front desk, and the
 * offer library's LapseReason is what the builder asks the gym about its
 * members in general. They were written months apart for different jobs and
 * they do not use the same words, so a mapping here is the honest fix rather
 * than renaming one set and breaking either the check constraint or the
 * library's own matching.
 */
export const REASON_TO_LAPSE: Record<CancellationReason, LapseReason> = {
  price: "price",
  relocation: "moved",
  dissatisfaction: "motivation",
  health: "injury",
  no_time: "time",
  other: "unknown",
};
