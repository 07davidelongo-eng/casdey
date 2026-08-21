"use client";

import { useActionState } from "react";

import { Button, Card, CardTitle, Notice } from "@/components/app/ui";
import { sendTestAction, type TestSendState } from "../actions";

const INITIAL: TestSendState = { error: null, sentTo: null };

/**
 * Roadmap #4: let the gym walk through the member's side before anyone
 * real gets this. What lands in their inbox is the real thing, same subject,
 * same reply-to, a working unsubscribe link, just for their own address and
 * marked "[Test]" so it is never mistaken for an actual reply.
 */
export function TestSendForm({
  campaignId,
  email,
}: {
  campaignId: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(sendTestAction, INITIAL);

  return (
    <Card>
      <CardTitle>See it for yourself first</CardTitle>
      <p className="mt-1 mb-4 text-[0.9375rem] text-graphite">
        Send this to your own inbox ({email}) exactly as a member would get
        it: same subject, same reply-to, and a working unsubscribe link. It
        does not go to anyone else and does not count against your send cap.
      </p>

      <form action={action}>
        <input type="hidden" name="campaignId" value={campaignId} />
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Sending" : "Send me a test"}
        </Button>
      </form>

      {state.sentTo ? (
        <div className="mt-4">
          <Notice>
            Sent to {state.sentTo}. Only the subject is marked &ldquo;[Test]&rdquo;,
            so you can reply to it and click the unsubscribe link the same way
            a member would.
          </Notice>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="notice notice-error mt-4">
          {state.error}
        </p>
      ) : null}
    </Card>
  );
}
