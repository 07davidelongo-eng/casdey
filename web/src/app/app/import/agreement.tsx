"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { Button, Card, CardTitle, Notice } from "@/components/app/ui";
import { agreeToProcessingAction, type AgreementState } from "./actions";

const INITIAL: AgreementState = { error: null };

/**
 * The gate in front of every patient upload.
 *
 * Deliberately not a wall of legal text nobody reads. It says the four things
 * that are actually true and actually matter, in the practice's own terms, and
 * links to the full processor terms for anyone who wants them.
 */
export function ProcessingAgreement({
  practiceName,
  canAgree,
}: {
  practiceName: string;
  canAgree: boolean;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(
    agreeToProcessingAction,
    INITIAL,
  );

  return (
    <Card>
      <CardTitle>Before you upload patient data</CardTitle>
      <p className="mt-1 text-[0.9375rem] text-graphite">
        You are about to send us records about real people. Here is exactly
        where that leaves both of us.
      </p>

      <ul className="mt-5 space-y-3 text-[0.9375rem] text-graphite">
        <Point>
          <strong className="font-semibold text-ink">
            {practiceName} stays in charge of this data.
          </strong>{" "}
          casdey only processes it to do what you ask: find dormant patients and
          contact them on your behalf. Nothing else, ever.
        </Point>
        <Point>
          <strong className="font-semibold text-ink">It stays in the EU.</strong>{" "}
          Stored in Ireland, encrypted, and never sold, shared or used to
          train anything.
        </Point>
        <Point>
          <strong className="font-semibold text-ink">
            You can take it back or wipe it at any time.
          </strong>{" "}
          Export or permanent deletion, both from settings, both immediate.
        </Point>
        <Point>
          <strong className="font-semibold text-ink">
            You confirm you may contact these patients
          </strong>{" "}
          about their care with you. That part is yours to know, not ours.
        </Point>
      </ul>

      <form action={action} className="mt-6">
        <label
          htmlFor={`${id}-confirm`}
          className="flex cursor-pointer items-start gap-3 text-[0.9375rem] text-graphite"
        >
          <input
            id={`${id}-confirm`}
            name="confirm"
            type="checkbox"
            value="yes"
            required
            disabled={!canAgree || pending}
            className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--teal)]"
          />
          <span>
            I confirm the above on behalf of {practiceName}, and I accept the{" "}
            <Link
              href="/terms/processing"
              className="text-teal underline underline-offset-4"
            >
              data processing terms
            </Link>
            .
          </span>
        </label>

        {state.error ? (
          <p role="alert" className="notice notice-error mt-4">
            {state.error}
          </p>
        ) : null}

        {canAgree ? (
          <Button type="submit" disabled={pending} className="mt-5">
            {pending ? "Saving" : "Confirm and continue"}
          </Button>
        ) : (
          <div className="mt-5">
            <Notice tone="warn">
              Only the practice owner can accept this.
            </Notice>
          </div>
        )}
      </form>
    </Card>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
      />
      <span>{children}</span>
    </li>
  );
}
