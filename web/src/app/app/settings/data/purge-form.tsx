"use client";

import { useActionState, useId, useState } from "react";

import { Button, Notice } from "@/components/app/ui";
import { purgePatientsAction, type PurgeState } from "./actions";

const INITIAL: PurgeState = { error: null, purged: null };

export function PurgeForm({
  practiceName,
  canPurge,
  patientCount,
}: {
  practiceName: string;
  canPurge: boolean;
  patientCount: number;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(purgePatientsAction, INITIAL);
  const [armed, setArmed] = useState(false);

  if (state.purged !== null) {
    return (
      <Notice>
        Deleted {state.purged} patient{state.purged === 1 ? "" : " records"}.
        Nothing is left.
      </Notice>
    );
  }

  if (!canPurge) {
    return <Notice tone="warn">Only the practice owner can do this.</Notice>;
  }

  if (patientCount === 0) {
    return (
      <p className="text-[0.9375rem] text-stone">
        There is no patient data to delete.
      </p>
    );
  }

  if (!armed) {
    return (
      <Button variant="danger" onClick={() => setArmed(true)}>
        Delete all patient data
      </Button>
    );
  }

  return (
    <form action={action}>
      <label htmlFor={`${id}-confirm`} className="field-label">
        Type{" "}
        <span className="literal text-ink">{practiceName}</span> to confirm
      </label>
      <input
        id={`${id}-confirm`}
        name="confirmName"
        required
        autoComplete="off"
        disabled={pending}
        className="field"
        placeholder={practiceName}
      />

      {state.error ? (
        <p role="alert" className="notice notice-error mt-4">
          {state.error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Deleting" : "Delete permanently"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
