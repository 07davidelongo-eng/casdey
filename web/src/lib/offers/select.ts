import { OFFERS } from "./library";
import type { Offer, OfferInputs } from "./types";

/**
 * Picks the offers worth showing a gym, best first.
 *
 * Deliberately returns several rather than one. casdey knows the patterns; the
 * gym knows its own room, its coaches and what it can actually honour on a
 * Tuesday. Handing back a single answer would be pretending to a certainty
 * this does not have, and a gym that disagrees with the one answer has nowhere
 * to go but away.
 */

export type ScoredOffer = { offer: Offer; score: number };

/**
 * Why the weights are ordered this way: the reason a member left is the thing
 * an offer has to answer, and getting it wrong makes the offer irrelevant
 * rather than merely imperfect. Budget is next because an offer the gym cannot
 * honour is worse than no offer at all — it is a promise broken in public.
 */
const WEIGHT_REASON = 4;
const WEIGHT_BUDGET = 3;
const WEIGHT_GYM_TYPE = 2;

export function rankOffers(inputs: OfferInputs): ScoredOffer[] {
  const scored: ScoredOffer[] = [];

  for (const offer of OFFERS) {
    // An offer that needs quiet hours is not merely a worse fit for a gym that
    // has none, it is undeliverable. Drop it rather than rank it low.
    if (offer.fits.needsOffPeak && !inputs.hasOffPeakCapacity) continue;

    // Likewise, never propose spending money a gym has told us it does not
    // have. This is the constraint gyms are most likely to be quietly wrong
    // about later, so casdey should not be the one pushing.
    if (!offer.fits.budgets.includes(inputs.budget)) continue;

    let score = 0;
    if (offer.fits.reasons.includes(inputs.reason)) score += WEIGHT_REASON;
    if (offer.fits.gymTypes.includes(inputs.gymType)) score += WEIGHT_GYM_TYPE;

    // A tighter budget makes the cheap offers better, not just permissible.
    if (
      inputs.budget === "capacity_only" &&
      offer.fits.budgets.includes("capacity_only")
    ) {
      score += WEIGHT_BUDGET;
    }

    scored.push({ offer, score });
  }

  // Stable within a score: library order is editorial, and the earlier entries
  // are the ones that work more often.
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * The date an offer runs out, as a real date rather than "14 days".
 *
 * A member reading "expires in 14 days" has to do arithmetic and will not.
 * "Ends Friday 19 September" is a thing they can act on, and it is the same
 * date for everyone in the campaign whenever the message actually goes out.
 */
export function deadlineFrom(start: Date, days: number): Date {
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + days);
  return end;
}

export function formatDeadline(date: Date, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/**
 * The offer as it will actually appear in a message, with the deadline filled.
 */
export function renderOffer(offer: Offer, deadline: Date): string {
  return offer.memberFacing.replace("{{deadline}}", formatDeadline(deadline));
}
