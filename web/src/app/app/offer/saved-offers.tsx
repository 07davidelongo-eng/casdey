"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle, Notice, Pill } from "@/components/app/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import {
  assignOfferToReasonAction,
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
  reasons,
}: {
  offers: SavedOffer[];
  currentBody: string | null;
  /** So an offer can be pointed at a reason from here, at the moment the gym
   *  is looking at it, rather than only from the reasons section (#46). */
  reasons: { key: string; label: string }[];
}) {
  const [useState_, use, using] = useActionState(useSavedOfferAction, INITIAL);
  const [deleteState, remove, removing] = useActionState(
    deleteSavedOfferAction,
    INITIAL,
  );
  const [assignState, assign, assigning] = useActionState(
    assignOfferToReasonAction,
    INITIAL,
  );
  // Collapsed by default, same as the services page (#46). An offer is three
  // or four lines of prose, so six of them open at once is a wall.
  const [open, setOpen] = useState<string | null>(null);

  if (offers.length === 0) return null;

  const error = useState_.error ?? deleteState.error ?? assignState.error;
  const message =
    useState_.message ?? deleteState.message ?? assignState.message;

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

      <ul className="space-y-3">
        {offers.map((offer) => {
          const inUse = currentBody !== null && offer.body === currentBody;
          const isOpen = open === offer.id;
          return (
            <li key={offer.id} className="rounded-xl border border-ash">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : offer.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-stone transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                >
                  <path
                    d="M7 4l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium text-ink">
                    {offer.name}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-stone">
                    {offer.body}
                  </span>
                </span>
                {inUse ? <Pill tone="teal">General offer</Pill> : null}
              </button>

              {isOpen ? (
                <div className="border-t border-ash p-4">
                  <p className="mb-4 rounded-md bg-mist p-3 text-[0.9375rem] text-graphite">
                    {offer.body}
                  </p>

                  <div className="flex flex-wrap items-center gap-4">
                    {!inUse ? (
                      <form action={use}>
                        <input type="hidden" name="offerId" value={offer.id} />
                        <Button type="submit" variant="quiet" disabled={using}>
                          Make this my general offer
                        </Button>
                      </form>
                    ) : null}

                    {/* Assigning from here rather than only from the reasons
                        section, because this is where the gym is looking when
                        it decides an offer is for one kind of member (#46). */}
                    {reasons.length > 0 ? (
                      <form action={assign} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="offerId" value={offer.id} />
                        <label
                          htmlFor={`reason-for-${offer.id}`}
                          className="text-[0.875rem] text-stone"
                        >
                          Or give it to
                        </label>
                        <select
                          id={`reason-for-${offer.id}`}
                          name="reason"
                          defaultValue=""
                          disabled={assigning}
                          className="field w-auto py-1 text-[0.875rem]"
                        >
                          <option value="" disabled>
                            a reason for leaving
                          </option>
                          {reasons.map((reason) => (
                            <option key={reason.key} value={reason.key}>
                              {reason.label}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="quiet" disabled={assigning}>
                          Assign
                        </Button>
                      </form>
                    ) : null}

                    <form
                      id={`delete-offer-${offer.id}`}
                      action={remove}
                      className="contents"
                    >
                      <input type="hidden" name="offerId" value={offer.id} />
                    </form>
                    <ConfirmButton
                      disabled={removing}
                      formId={`delete-offer-${offer.id}`}
                      title={`Delete "${offer.name}"?`}
                      body={
                        inUse
                          ? "It comes out of this list. It stays your general offer until you pick another, and members already promised it keep it."
                          : "It comes out of this list for good. Members already promised it keep it."
                      }
                      className="text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
                    >
                      Delete
                    </ConfirmButton>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
