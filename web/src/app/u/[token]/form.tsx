"use client";

import { useActionState } from "react";

import { Button } from "@/components/app/ui";
import { unsubscribeAction, type UnsubscribeState } from "./actions";

const INITIAL: UnsubscribeState = { done: false, error: null };

export function UnsubscribeForm({
  token,
  gymName,
}: {
  token: string;
  gymName: string;
}) {
  const [state, action, pending] = useActionState(unsubscribeAction, INITIAL);

  if (state.done) {
    return (
      <div className="card p-7">
        <h1 className="display text-[1.375rem]">Done</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          You will not get any more of these from {gymName}. Nothing else
          changes: this does not affect your membership, bookings or records
          with them.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-7">
      <h1 className="display text-[1.5rem]">Stop these emails?</h1>
      <p className="mt-3 text-[0.9375rem] text-graphite">
        {gymName} will stop sending you these reminders. Your membership and
        your records with them are not affected, and you can still book any
        time.
      </p>

      <form action={action} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" disabled={pending}>
          {pending ? "One moment" : "Yes, unsubscribe me"}
        </Button>
      </form>

      {state.error ? (
        <p role="alert" className="notice notice-error mt-4">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
