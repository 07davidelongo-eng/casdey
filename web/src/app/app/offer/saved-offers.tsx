"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle, Notice, Pill } from "@/components/app/ui";
import {
  deleteSavedOfferAction,
  useSavedOfferAction,
  type OfferState,
} from "./actions";

const INITIAL: OfferState = { error: null, message: null };

export type SavedOffer = {
  id: string;
  name: string;
  body: string;
  expires_at: string | null;
  created_at: string;
};

/**
 * Every offer this gym has written, kept.
 *
 * The point of a list rather than a single current offer: a gym runs a free
 * week in January, tries half off in March, and wants January back in June.
 * Before this, choosing the second one destroyed the first, so "try something
 * else" and "lose what you had" were the same action.
 *
 * The offer in use is marked rather than separated out, because it is the same
 * kind of thing as the others and pulling it into its own box makes switching
 * back feel like a bigger decision than it is.
 */
export function SavedOffers({
  offers,
  currentBody,
}: {
  offers: SavedOffer[];
  currentBody: string | null;
}) {
  const [useState_, use, using] = useActionState(useSavedOfferAction, INITIAL);
  const [deleteState, remove, removing] = useActionState(
    deleteSavedOfferAction,
    INITIAL,
  );
  const [confirming, setConfirming] = useState<string | null>(null);

  if (offers.length === 0) return null;

  const error = useState_.error ?? deleteState.error;
  const message = useState_.message ?? deleteState.message;

  return (
    <Card>
      <CardTitle>Your offers</CardTitle>
      <p className="mb-5 text-[0.875rem] leading-relaxed text-stone">
        Everything you have written, kept. Switch between them whenever you
        like. Members who were already promised one keep it, whatever you change
        here.
      </p>

      {error ? (
        <div className="mb-4">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}
      {message ? (
        <div className="mb-4">
          <Notice>{message}</Notice>
        </div>
      ) : null}

      <ul className="space-y-4">
        {offers.map((offer) => {
          const inUse = currentBody !== null && offer.body === currentBody;
          return (
            <li
              key={offer.id}
              className="rounded-xl border border-ash p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[0.9375rem] font-medium text-ink">
                  {offer.name}
                </span>
                {inUse ? <Pill tone="teal">In use</Pill> : null}
              </div>

              <p className="mb-3 rounded-md bg-mist p-3 text-[0.9375rem] text-graphite">
                {offer.body}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                {!inUse ? (
                  <form action={use}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <Button type="submit" variant="quiet" disabled={using}>
                      Use this one
                    </Button>
                  </form>
                ) : null}

                {confirming === offer.id ? (
                  <form action={remove} className="flex items-center gap-3">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <span className="text-[0.875rem] text-graphite">
                      Delete it?
                    </span>
                    <button
                      type="submit"
                      disabled={removing}
                      className="text-[0.875rem] font-medium text-[var(--danger)] underline underline-offset-4"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
                    >
                      Keep it
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(offer.id)}
                    className="text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
