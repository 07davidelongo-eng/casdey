"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle, Notice, Pill } from "@/components/app/ui";
import type { ResolvedReason } from "@/lib/cancellation";
import type { OfferVariants } from "@/lib/offers/variants";
import { saveOfferVariantsAction, type OfferState } from "./actions";

const INITIAL: OfferState = { error: null, message: null };

/**
 * A different offer for a different reason for leaving.
 *
 * Collapsed until asked for. Most gyms will run one offer and should not be
 * made to scroll past six empty boxes to prove it; the gym that knows its
 * price-sensitive members need something different from its injured ones can
 * open this and say so.
 *
 * The count of members casdey actually holds a reason for is shown next to
 * each one, because a beautifully written offer for a reason nobody is tagged
 * with reaches nobody, and that is worth knowing before writing it rather
 * than after.
 */
export function OfferVariantsForm({
  reasons,
  variants,
  reasonCounts,
  hasDefault,
}: {
  /** casdey's six plus whatever this gym added (#33). */
  reasons: ResolvedReason[];
  variants: OfferVariants;
  reasonCounts: Record<string, number>;
  hasDefault: boolean;
}) {
  const [open, setOpen] = useState(
    () => Object.keys(variants).length > 0,
  );
  const [state, action, pending] = useActionState(
    saveOfferVariantsAction,
    INITIAL,
  );

  if (!open) {
    return (
      <Card>
        <CardTitle>Different reasons, different offers</CardTitle>
        <p className="mb-4 text-[0.875rem] leading-relaxed text-stone">
          Right now every lapsed member gets the same offer, which assumes they
          all left for the same reason. Somebody who left because it was
          expensive and somebody who left with an injury need opposite things
          said to them. Where casdey knows why a member left, it can send the
          offer written for that.
        </p>
        <Button type="button" variant="quiet" onClick={() => setOpen(true)}>
          Write offers per reason
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Different reasons, different offers</CardTitle>
      <p className="mb-5 text-[0.875rem] leading-relaxed text-stone">
        Leave one blank and those members get your general offer instead. A
        member with no reason on file always gets the general one.
      </p>

      {!hasDefault ? (
        <div className="mb-5">
          <Notice tone="warn">
            You have no general offer yet, so a member whose reason you do not
            know gets no offer at all. Build one above first.
          </Notice>
        </div>
      ) : null}

      <form action={action} className="space-y-5">
        {reasons.map((option) => {
          const count = reasonCounts[option.value] ?? 0;
          return (
            <div key={option.value}>
              <div className="mb-1.5 flex flex-wrap items-center gap-3">
                <label
                  htmlFor={`variant-${option.value}`}
                  className="field-label mb-0"
                >
                  {option.label}
                </label>
                <Pill tone={count > 0 ? "teal" : "quiet"}>
                  {count} {count === 1 ? "member" : "members"}
                </Pill>
              </div>
              <textarea
                id={`variant-${option.value}`}
                name={`variant-${option.value}`}
                rows={3}
                maxLength={600}
                disabled={pending}
                defaultValue={variants[option.value]?.text ?? ""}
                placeholder="Leave blank to use your general offer"
                className="field leading-relaxed"
              />
            </div>
          );
        })}

        {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
        {state.message ? <Notice>{state.message}</Notice> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save these offers"}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Hide
          </Button>
        </div>
      </form>
    </Card>
  );
}
