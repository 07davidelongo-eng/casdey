"use client";

import { useActionState, useState } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import { REASON_OPTIONS, type CancellationReason } from "@/lib/cancellation";
import {
  deleteMemberAction,
  markCancelledAction,
  markReturnedAction,
  unmarkReturnedAction,
  type MemberActionState,
} from "./actions";

const INITIAL: MemberActionState = { error: null };

export function MemberActions({
  memberId,
  name,
  alreadyReturned,
  cancellationReason,
}: {
  memberId: string;
  name: string;
  alreadyReturned: boolean;
  cancellationReason: CancellationReason | null;
}) {
  const [returnState, returnAction, returning] = useActionState(
    markReturnedAction,
    INITIAL,
  );
  const [undoState, undoAction, undoing] = useActionState(
    unmarkReturnedAction,
    INITIAL,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteMemberAction,
    INITIAL,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    markCancelledAction,
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);
  const [editingReason, setEditingReason] = useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardTitle>Did they book again?</CardTitle>
        <p className="mt-1 mb-4 text-[0.875rem] text-stone">
          casdey cannot see your diary, so this is the one thing it has to be
          told. It is what the returned count is built from.
        </p>

        {alreadyReturned ? (
          <>
            <p className="text-[0.9375rem] text-graphite">
              Already recorded as returned.
            </p>
            <form action={undoAction} className="mt-3">
              <input type="hidden" name="memberId" value={memberId} />
              <Button type="submit" variant="ghost" disabled={undoing}>
                {undoing ? "Undoing" : "Undo, they did not return"}
              </Button>
            </form>
          </>
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
        {undoState.error ? (
          <p role="alert" className="notice notice-error mt-3">
            {undoState.error}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Why did they leave?</CardTitle>
        <p className="mt-1 mb-4 text-[0.875rem] text-stone">
          Optional, but it makes a formal cancellation an immediate win-back
          match instead of waiting for the lapse window, and lets a campaign
          reference it with {"{{reason}}"}.
        </p>

        {cancellationReason && !editingReason ? (
          <>
            <p className="text-[0.9375rem] text-graphite">
              Recorded:{" "}
              {REASON_OPTIONS.find((option) => option.value === cancellationReason)
                ?.label ?? cancellationReason}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-3"
              onClick={() => setEditingReason(true)}
            >
              Change
            </Button>
          </>
        ) : (
          <form action={cancelAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="memberId" value={memberId} />
            <select
              name="reason"
              defaultValue={cancellationReason ?? ""}
              className="field"
              required
            >
              <option value="" disabled>
                Pick a reason
              </option>
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button type="submit" variant="quiet" disabled={cancelling}>
              {cancelling ? "Saving" : "Save"}
            </Button>
          </form>
        )}

        {cancelState.error ? (
          <p role="alert" className="notice notice-error mt-3">
            {cancelState.error}
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
