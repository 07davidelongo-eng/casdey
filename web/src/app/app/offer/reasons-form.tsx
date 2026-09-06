"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle, Notice, Pill } from "@/components/app/ui";
import { REASON_OPTIONS, reasonKeyFrom } from "@/lib/cancellation";
import { saveReasonsAction, type OfferState } from "./actions";

const INITIAL: OfferState = { error: null, message: null };

type Row = { key: string; label: string; phrase: string };

/**
 * Why members leave, in this gym's words (#33).
 *
 * Given its own card near the top of the page rather than buried inside the
 * per-reason offers, because the reasons come first: a gym cannot write an
 * offer for "the creche closed" until "the creche closed" is something casdey
 * knows about. Davide's point exactly, and it was hidden before.
 *
 * casdey's six are shown but not editable. They are referenced by key in
 * message templates, in the offer variants and on member rows going back
 * months, and letting a gym rename "price" to mean something else would quietly
 * change what every one of those meant.
 */
export function ReasonsForm({
  custom,
  counts,
}: {
  custom: Row[];
  counts: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(saveReasonsAction, INITIAL);
  const [rows, setRows] = useState<Row[]>(custom);
  const [open, setOpen] = useState(custom.length > 0);

  /**
   * Keys that already exist in the database.
   *
   * Their key is frozen from here on, because it is what members are tagged
   * with: rebuilding it from an edited label would orphan every member
   * recorded against the old one, and they would silently drop back to the
   * general offer. The label can be corrected freely, which is what a gym
   * actually wants when it renames one.
   */
  const [savedKeys] = useState(() => new Set(custom.map((row) => row.key)));

  function update(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  if (!open) {
    return (
      <Card>
        <CardTitle>Why members leave</CardTitle>
        <p className="mb-4 text-[0.875rem] leading-relaxed text-stone">
          casdey comes with six reasons, and your gym almost certainly has
          others. Add your own and they appear on every member, in the campaign
          filter, and in the offers below, so you can write something that
          answers the reason people actually give you.
        </p>
        <Button type="button" variant="quiet" onClick={() => setOpen(true)}>
          Add your own reasons
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Why members leave</CardTitle>
      <p className="mb-5 text-[0.875rem] leading-relaxed text-stone">
        Recorded on a member when they tell you. casdey uses it to pick which
        offer they get, and can say it back to them in the message.
      </p>

      <div className="mb-6">
        <p className="field-label">casdey&apos;s own</p>
        <div className="flex flex-wrap gap-2">
          {REASON_OPTIONS.map((option) => (
            <Pill key={option.value}>
              {option.label}
              {counts[option.value] ? ` · ${counts[option.value]}` : ""}
            </Pill>
          ))}
        </div>
        <p className="field-hint">
          These stay. Members and past messages refer to them by name, so
          renaming one would change what it meant everywhere it has been used.
        </p>
      </div>

      <form action={action}>
        <input type="hidden" name="reasons" value={JSON.stringify(rows)} />

        <p className="field-label">Yours</p>

        {rows.length === 0 ? (
          <p className="mb-4 text-[0.875rem] text-stone">
            Nothing yet. Add the reason you hear most that is not in the list
            above.
          </p>
        ) : null}

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
                    disabled={pending}
                    onChange={(event) =>
                      update(index, {
                        label: event.target.value,
                        key: savedKeys.has(row.key)
                          ? row.key
                          : reasonKeyFrom(event.target.value),
                      })
                    }
                    placeholder="Childcare fell through"
                    className="field"
                  />
                  <p className="field-hint">
                    Staff see this when they record why somebody left.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setRows((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove ${row.label || "this reason"}`}
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
                </button>
              </div>

              <label className="field-label" htmlFor={`phrase-${index}`}>
                How it reads to the member
              </label>
              <input
                id={`phrase-${index}`}
                value={row.phrase}
                maxLength={80}
                disabled={pending}
                onChange={(event) => update(index, { phrase: event.target.value })}
                placeholder="the childcare"
                className="field"
              />
              <p className="field-hint">
                Goes inside {"{{reason}}"}, so it has to finish the sentence
                &quot;we know it was mostly about ...&quot;. Gentle, because the
                person reading it is the one who told you.
              </p>

              {counts[row.key] ? (
                <p className="mt-2 text-[0.8125rem] text-stone">
                  {counts[row.key]}{" "}
                  {counts[row.key] === 1 ? "member is" : "members are"} recorded
                  with this.
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            setRows((current) => [...current, { key: "", label: "", phrase: "" }])
          }
          className="mt-4 text-[0.9375rem] font-semibold text-teal hover:text-teal-hover"
        >
          + Add a reason
        </button>

        {state.error ? (
          <div className="mt-4">
            <Notice tone="warn">{state.error}</Notice>
          </div>
        ) : null}
        {state.message ? (
          <div className="mt-4">
            <Notice>{state.message}</Notice>
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save reasons"}
          </Button>
          <Button
            type="button"
            variant="quiet"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Hide
          </Button>
        </div>

        <p className="mt-3 text-[0.8125rem] text-stone">
          Removing one here does not change members already recorded with it.
          They keep what they were tagged with, and casdey falls back to its
          general wording for them.
        </p>
      </form>
    </Card>
  );
}
