"use client";

import { Button, Card, CardTitle } from "@/components/app/ui";
import type { Offer, OfferInputs } from "@/lib/offers/types";

/**
 * Where the suggestion becomes the gym's own offer.
 *
 * casdey's wording is a starting point, not a rule. A gym that wants a quarter
 * off the first month rather than half off two should not have to accept ours
 * or abandon the tool: they know their margin, their capacity and what they
 * have already promised people at the front desk, and none of that is visible
 * from here.
 *
 * The text the gym leaves in this box is exactly what members receive. Nothing
 * re-renders it afterwards.
 */
export function EditStep({
  offer,
  suggested,
  inputs,
  formAction,
  pending,
  onBack,
}: {
  offer: Offer;
  suggested: string;
  inputs: OfferInputs | null;
  formAction: (formData: FormData) => void;
  pending: boolean;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardTitle>Make it yours</CardTitle>
      <p className="mb-4 text-[0.875rem] text-stone">
        This is casdey&apos;s suggestion for{" "}
        <strong className="text-ink">{offer.name}</strong>, and it is only a
        starting point. Change the numbers, the terms, the tone, any of it. What
        you leave here is word for word what your members will read.
      </p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="offerId" value={offer.id} />
        <input
          type="hidden"
          name="inputs"
          value={inputs ? JSON.stringify(inputs) : ""}
        />

        <div>
          <label className="field-label mb-1 block" htmlFor="offer-text">
            Your offer, as a member reads it
          </label>
          <textarea
            id="offer-text"
            name="text"
            rows={5}
            defaultValue={suggested}
            maxLength={600}
            required
            className="w-full rounded-lg border border-line bg-paper p-3 text-[0.9375rem] leading-relaxed"
          />
          <p className="mt-1 text-[0.8125rem] text-stone">
            Keep the date in if you want a deadline. An offer with no end is not
            an offer, but it is your call.
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Save this offer
          </Button>
          <Button type="button" variant="quiet" onClick={onBack}>
            Back to suggestions
          </Button>
        </div>
      </form>
    </Card>
  );
}
