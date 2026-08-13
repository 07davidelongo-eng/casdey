"use client";

import { useActionState } from "react";

import { Button } from "@/components/app/ui";
import { unsubscribeAction, type UnsubscribeState } from "./actions";

const INITIAL: UnsubscribeState = { done: false, error: null };

export function UnsubscribeForm({
  token,
  practiceName,
}: {
  token: string;
  practiceName: string;
}) {
  const [state, action, pending] = useActionState(unsubscribeAction, INITIAL);

  if (state.done) {
    return (
      <div className="card p-7">
        <h1 className="display text-[1.375rem]">Done</h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          You will not get any more of these from {practiceName}. Nothing else
          changes: this does not affect your care, appointments or records with
          them.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-7">
      <h1 className="display text-[1.5rem]">Stop these emails?</h1>
      <p className="mt-3 text-[0.9375rem] text-graphite">
        {practiceName} will stop sending you check-up reminders. Your care and
        your records with them are not affected, and you can still book an
        appointment any time.
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
