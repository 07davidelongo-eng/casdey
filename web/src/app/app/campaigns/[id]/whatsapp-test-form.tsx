"use client";

import { useActionState, useId, useState } from "react";

import { Button, Card, CardTitle, Notice } from "@/components/app/ui";
import { sendWhatsAppTestAction, type WhatsAppTestState } from "../actions";

const INITIAL: WhatsAppTestState = { error: null, sentTo: null };

/**
 * The WhatsApp side of the client self-test. Unlike email's TestSendForm,
 * there is no single obvious "my own address" to default to, so the gym types
 * the number to test with. What lands on that number is the real approved
 * template, and replying to it rides the exact same webhook -> AI loop ->
 * hand-off path a real member's reply would.
 */
export function WhatsAppTestForm({
  campaignId,
  whatsappEnabled,
}: {
  campaignId: string;
  whatsappEnabled: boolean;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(sendWhatsAppTestAction, INITIAL);
  const [phone, setPhone] = useState("");

  if (!whatsappEnabled) {
    return (
      <Card>
        <CardTitle>See it for yourself first</CardTitle>
        <p className="mt-1 text-[0.9375rem] text-graphite">
          WhatsApp is not turned on for this gym, so there is nothing to test
          yet.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>See it for yourself first</CardTitle>
      <p className="mt-1 mb-4 text-[0.9375rem] text-graphite">
        Send the opening template to your own WhatsApp. Reply to it and the
        conversation continues exactly as it would for a real member, including
        casdey&apos;s assistant and the hand-off when you say you want to book.
      </p>

      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="max-w-[16rem] flex-1">
          <label htmlFor={`${id}-phone`} className="field-label">
            Your WhatsApp number
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            required
            placeholder="+44 7700 900123"
            disabled={pending}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="field literal"
          />
        </div>
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Sending" : "Send me a test"}
        </Button>
      </form>

      {state.sentTo ? (
        <div className="mt-4">
          <Notice>
            Sent to {state.sentTo}. Reply to it the same way a member would,
            including trying STOP to see the opt-out.
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
