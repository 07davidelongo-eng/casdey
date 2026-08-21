"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import {
  deleteMemberAction,
  markReturnedAction,
  type MemberActionState,
} from "./actions";

const INITIAL: MemberActionState = { error: null };

export function MemberActions({
  memberId,
  name,
  alreadyReturned,
}: {
  memberId: string;
  name: string;
  alreadyReturned: boolean;
}) {
  const [returnState, returnAction, returning] = useActionState(
    markReturnedAction,
    INITIAL,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteMemberAction,
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardTitle>Did they book again?</CardTitle>
        <p className="mt-1 mb-4 text-[0.875rem] text-stone">
          casdey cannot see your diary, so this is the one thing it has to be
          told. It is what the returned count is built from.
        </p>

        {alreadyReturned ? (
          <p className="text-[0.9375rem] text-graphite">
            Already recorded as returned.
          </p>
        ) : (
          <form action={returnAction}>
            <input type="hidden" name="memberId" value={memberId} />
            <Button type="submit" variant="quiet" disabled={returning}>
              {returning ? "Saving" : "Mark as returned"}
            </Button>
          </form>
        )}

        {returnState.error ? (
          <p role="alert" className="notice notice-error mt-3">
            {returnState.error}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Erase this member</CardTitle>
        <p className="mt-1 mb-4 text-[0.875rem] text-stone">
          Deletes {name} and their whole history, permanently. Their address is
          kept on the do-not-contact list so a future import cannot bring them
          back.
        </p>

        {!confirming ? (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Erase permanently
          </Button>
        ) : (
          <form action={deleteAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="memberId" value={memberId} />
            <Button type="submit" variant="danger" disabled={deleting}>
              {deleting ? "Erasing" : "Yes, erase for good"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </form>
        )}

        {deleteState.error ? (
          <p role="alert" className="notice notice-error mt-3">
            {deleteState.error}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
