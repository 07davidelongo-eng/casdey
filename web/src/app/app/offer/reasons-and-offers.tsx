"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle, Notice, Pill } from "@/components/app/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { reasonKeyFrom } from "@/lib/cancellation";
import type { OfferVariants } from "@/lib/offers/variants";
import {
  assignOfferToReasonAction,
  saveReasonsAction,
  saveOfferVariantsAction,
  type OfferState,
} from "./actions";

const INITIAL: OfferState = { error: null, message: null };

export type SavedOfferOption = { id: string; name: string; body: string };
type Row = { key: string; label: string; phrase: string };

/**
 * Why members leave, and what each of them is offered, in one place (#46).
 *
 * These were two separate cards, which was the wrong shape: the reasons only
 * exist so that an offer can answer one, and a gym opening this page to write
 * a price-sensitive offer had to find a different card first to invent the
 * reason. One section now, reasons at the top, and each reason carries its own
 * offer directly underneath it.
 *
 * Every reason belongs to the gym, casdey's original six included. They can be
 * renamed, reworded, deleted and added to, which is what #46 asked for and
 * what the previous design specifically refused.
 */
export function ReasonsAndOffers({
  reasons,
  variants,
  reasonCounts,
  savedOffers,
  hasDefault,
}: {
  reasons: Row[];
  variants: OfferVariants;
  reasonCounts: Record<string, number>;
  savedOffers: SavedOfferOption[];
  hasDefault: boolean;
}) {
  const [reasonState, saveReasons, savingReasons] = useActionState(
    saveReasonsAction,
    INITIAL,
  );
  const [assignState, assign, assigning] = useActionState(
    assignOfferToReasonAction,
    INITIAL,
  );
  const [variantState, saveVariants, savingVariants] = useActionState(
    saveOfferVariantsAction,
    INITIAL,
  );

  const [rows, setRows] = useState<Row[]>(reasons);
  const [savedKeys] = useState(() => new Set(reasons.map((row) => row.key)));
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  function update(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  const error = reasonState.error ?? assignState.error ?? variantState.error;
  const message =
    reasonState.message ?? assignState.message ?? variantState.message;

  return (
    <Card>
      <CardTitle>Different reasons, different offers</CardTitle>
      <p className="mb-5 text-[0.9375rem] leading-relaxed text-stone">
        Somebody who left because it was expensive and somebody who left with an
        injury need opposite things said to them. Where you have recorded why a
        member left, casdey sends the offer written for that. Anyone without a
        reason on file gets your general offer.
      </p>

      {!hasDefault ? (
        <div className="mb-5">
          <Notice tone="warn">
            You have no general offer yet, so a member whose reason you do not
            know gets no offer at all. Build one above first.
          </Notice>
        </div>
      ) : null}

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

      {/* Reading mode: one collapsible row per reason, same shape as the
          services page, so twenty reasons stay as readable as three. */}
      {!editing ? (
        <>
          <div className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-[0.9375rem] text-graphite">
                You have no reasons left. Add one to start recording why members
                leave.
              </p>
            ) : null}

            {rows.map((row) => {
              const isOpen = open === row.key;
              const variant = variants[row.key];
              const count = reasonCounts[row.key] ?? 0;
              /**
               * Which saved offer this reason is currently using, if any.
               *
               * Matched on the wording, because that is what a variant stores:
               * assigning an offer copies its text across on purpose, so that
               * editing the offer later cannot rewrite what a member was
               * already promised. The copy is the feature; this is how the
               * screen reads it back.
               *
               * Two consequences, both correct. An offer whose wording has
               * since been edited stops matching, and the reason then reads as
               * its own wording rather than claiming to be an offer it no
               * longer matches. And a reason whose text was typed by hand
               * matches nothing, which is exactly what it is.
               */
              const assigned = variant
                ? savedOffers.find((offer) => offer.body === variant.text)
                : undefined;
              return (
                <div key={row.key} className="rounded-xl border border-ash">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : row.key)}
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
                        {row.label}
                      </span>
                      <span className="block truncate text-[0.8125rem] text-stone">
                        {assigned
                          ? assigned.name
                          : variant
                            ? variant.text
                            : "Uses your general offer"}
                      </span>
                    </span>
                    <Pill tone={count > 0 ? "teal" : "quiet"}>
                      {count} {count === 1 ? "member" : "members"}
                    </Pill>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-ash p-4">
                      <p className="mb-3 text-[0.8125rem] text-stone">
                        In a message this reads as &quot;...it was mostly about{" "}
                        <span className="literal text-graphite">
                          {row.phrase}
                        </span>
                        &quot;.
                      </p>

                      {savedOffers.length > 0 ? (
                        <form action={assign} className="mb-4">
                          <input type="hidden" name="reason" value={row.key} />
                          <label
                            className="field-label"
                            htmlFor={`assign-${row.key}`}
                          >
                            Use one of your offers
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Keyed on what is actually assigned, so the
                                control shows the current answer after a save
                                rather than snapping back to "general offer"
                                and implying nothing was saved. */}
                            <select
                              key={assigned?.id ?? "none"}
                              id={`assign-${row.key}`}
                              name="offerId"
                              defaultValue={assigned?.id ?? ""}
                              disabled={assigning}
                              className="field w-auto max-w-full"
                            >
                              <option value="">
                                My general offer (nothing special)
                              </option>
                              {savedOffers.map((offer) => (
                                <option key={offer.id} value={offer.id}>
                                  {offer.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="submit"
                              variant="quiet"
                              disabled={assigning}
                            >
                              Use it for this reason
                            </Button>
                          </div>
                          <p className="field-hint">
                            Copies the wording across now. Editing that offer
                            later will not rewrite what a member was already
                            promised.
                          </p>
                        </form>
                      ) : null}

                      <form action={saveVariants}>
                        <label
                          className="field-label"
                          htmlFor={`variant-${row.key}`}
                        >
                          Or write one just for this reason
                        </label>
                        <textarea
                          id={`variant-${row.key}`}
                          name={`variant-${row.key}`}
                          rows={3}
                          maxLength={600}
                          disabled={savingVariants}
                          defaultValue={variant?.text ?? ""}
                          placeholder="Leave blank to use your general offer"
                          className="field leading-relaxed"
                        />
                        {/* Every other reason's box has to travel with this
                            form: the action writes the whole map, so a missing
                            field reads as a cleared offer. */}
                        {rows
                          .filter((other) => other.key !== row.key)
                          .map((other) => (
                            <input
                              key={other.key}
                              type="hidden"
                              name={`variant-${other.key}`}
                              value={variants[other.key]?.text ?? ""}
                            />
                          ))}
                        <div className="mt-3">
                          <Button type="submit" disabled={savingVariants}>
                            {savingVariants ? "Saving" : "Save this offer"}
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <Button type="button" variant="quiet" onClick={() => setEditing(true)}>
              Edit the reasons
            </Button>
          </div>
        </>
      ) : (
        /* Editing mode: the list itself, all of it editable. */
        <form action={saveReasons}>
          <input type="hidden" name="reasons" value={JSON.stringify(rows)} />

          <div className="space-y-4">
            {rows.map((row, index) => (
              <div key={index} className="rounded-xl border border-ash p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex-1">
                    <label className="field-label" htmlFor={`reason-${index}`}>
                      What you call it
                    </label>
                    <input
                      id={`reason-${index}`}
                      value={row.label}
                      maxLength={60}
                      disabled={savingReasons}
                      onChange={(event) =>
                        update(index, {
                          label: event.target.value,
                          // Frozen once saved: the key is what members are
                          // tagged with, and rebuilding it from an edited label
                          // would orphan every one of them.
                          key: savedKeys.has(row.key)
                            ? row.key
                            : reasonKeyFrom(event.target.value),
                        })
                      }
                      placeholder="Childcare fell through"
                      className="field"
                    />
                  </div>

                  <ConfirmButton
                    disabled={savingReasons}
                    ariaLabel={`Remove ${row.label || "this reason"}`}
                    title={`Delete "${row.label || "this reason"}"?`}
                    body={
                      <>
                        It disappears from the member picker, the campaign
                        filter and this list.
                        {reasonCounts[row.key] ? (
                          <>
                            {" "}
                            The{" "}
                            <strong>
                              {reasonCounts[row.key]}{" "}
                              {reasonCounts[row.key] === 1
                                ? "member"
                                : "members"}
                            </strong>{" "}
                            already recorded with it keep their history, and
                            casdey falls back to its general wording for them.
                          </>
                        ) : null}{" "}
                        You still have to press Save for this to take effect.
                      </>
                    }
                    onConfirm={() =>
                      setRows((current) => current.filter((_, i) => i !== index))
                    }
                    className="mt-7 shrink-0 text-stone hover:text-ink disabled:opacity-40"
                  >
                    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
                      <path
                        d="M6 6l8 8M14 6l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </ConfirmButton>
                </div>

                <label className="field-label" htmlFor={`phrase-${index}`}>
                  How it reads to the member
                </label>
                <input
                  id={`phrase-${index}`}
                  value={row.phrase}
                  maxLength={80}
                  disabled={savingReasons}
                  onChange={(event) =>
                    update(index, { phrase: event.target.value })
                  }
                  placeholder="the childcare"
                  className="field"
                />
                <p className="field-hint">
                  Finishes the sentence &quot;we know it was mostly about
                  ...&quot;. Gentle, because the person reading it is the one who
                  told you.
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={savingReasons}
            onClick={() =>
              setRows((current) => [...current, { key: "", label: "", phrase: "" }])
            }
            className="mt-4 text-[0.9375rem] font-semibold text-teal hover:text-teal-hover"
          >
            + Add a reason
          </button>

          <div className="mt-5 flex gap-2">
            <Button type="submit" disabled={savingReasons}>
              {savingReasons ? "Saving" : "Save reasons"}
            </Button>
            <Button
              type="button"
              variant="quiet"
              disabled={savingReasons}
              onClick={() => {
                setRows(reasons);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
