"use client";

import { useActionState, useId, useState } from "react";

import { Button, Notice } from "@/components/app/ui";
import { purgeMembersAction, type PurgeState } from "./actions";

const INITIAL: PurgeState = { error: null, purged: null };

export function PurgeForm({
  gymName,
  canPurge,
  memberCount,
}: {
  gymName: string;
  canPurge: boolean;
  memberCount: number;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(purgeMembersAction, INITIAL);
  const [armed, setArmed] = useState(false);

  if (state.purged !== null) {
    return (
      <Notice>
        Deleted {state.purged} member{state.purged === 1 ? "" : " records"}.
        Nothing is left.
      </Notice>
    );
  }

  if (!canPurge) {
    return <Notice tone="warn">Only the gym owner can do this.</Notice>;
  }

  if (memberCount === 0) {
    return (
      <p className="text-[0.9375rem] text-stone">
        There is no member data to delete.
      </p>
    );
  }

  if (!armed) {
    return (
      <Button variant="danger" onClick={() => setArmed(true)}>
        Delete all member data
      </Button>
    );
  }

  return (
    <form action={action}>
      <label htmlFor={`${id}-confirm`} className="field-label">
        Type{" "}
        <span className="literal text-ink">{gymName}</span> to confirm
      </label>
      <input
        id={`${id}-confirm`}
        name="confirmName"
        required
        autoComplete="off"
        disabled={pending}
        className="field"
        placeholder={gymName}
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
