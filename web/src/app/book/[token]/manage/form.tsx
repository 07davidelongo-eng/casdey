"use client";

import { useActionState } from "react";

import { Button } from "@/components/app/ui";
import { cancelAppointmentAction, type CancelState } from "./actions";

const INITIAL: CancelState = { cancelled: false, error: null };

export function CancelForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(cancelAppointmentAction, INITIAL);

  if (state.cancelled) {
    return (
      <p role="status" className="notice notice-info mt-6">
        Cancelled. You are no longer booked in.
      </p>
    );
  }

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "One moment" : "Cancel this appointment"}
      </Button>
      {state.error ? (
        <p role="alert" className="notice notice-error mt-4">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
