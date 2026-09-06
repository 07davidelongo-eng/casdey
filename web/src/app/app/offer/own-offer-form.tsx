"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle, Notice } from "@/components/app/ui";
import { writeOwnOfferAction, type OfferState } from "./actions";

const INITIAL: OfferState = { error: null, message: null };

/**
 * The way past the builder for a gym that already knows its own offer.
 *
 * casdey's library is a starting point, not a ceiling. Making somebody answer
 * five questions to reach a text box they were always going to overwrite is
 * how a tool earns the reputation of getting in the way.
 */
export function OwnOfferForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(writeOwnOfferAction, INITIAL);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[0.9375rem] text-teal underline decoration-ash underline-offset-4 transition-colors duration-200 hover:decoration-teal"
      >
        Or write your own offer
      </button>
    );
  }

  return (
    <Card>
      <CardTitle>Your own offer</CardTitle>
      <p className="mb-4 text-[0.875rem] leading-relaxed text-stone">
        Word for word what a member reads. If it has a deadline, say how many
        days and casdey turns it into a real date in every message.
      </p>

      <form action={action} className="space-y-4">
        <textarea
          name="text"
          rows={5}
          maxLength={600}
          required
          disabled={pending}
          placeholder="Come back this month and your first two weeks are on us."
          className="field leading-relaxed"
        />

        <div className="flex items-center gap-3">
          <label htmlFor="own-deadline" className="field-label mb-0">
            Open for
          </label>
          <input
            id="own-deadline"
            name="deadlineDays"
            type="number"
            min={1}
            max={90}
            step={1}
            defaultValue={14}
            disabled={pending}
            className="field literal w-24"
          />
          <span className="text-[0.9375rem] text-graphite">
            days, or blank for no deadline
          </span>
        </div>

        {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
        {state.message ? <Notice>{state.message}</Notice> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save this offer"}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
