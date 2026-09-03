"use client";

import { useActionState, useId } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import type { Gym } from "@/lib/types";
import { saveWhatsAppSettingsAction, type WhatsAppSettingsState } from "./actions";

const INITIAL: WhatsAppSettingsState = { error: null, saved: false };

export function WhatsAppSettingsForm({
  gym,
  readOnly,
}: {
  gym: Gym;
  readOnly: boolean;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(
    saveWhatsAppSettingsAction,
    INITIAL,
  );
  const disabled = readOnly || pending;

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardTitle>The shared casdey number</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          casdey sends WhatsApp messages from one number shared across every
          gym, the same way its emails go out from{" "}
          <span className="literal">mail.casdey.com</span>. Every message is
          signed with your gym name, and only members you have imported and who
          have not opted out are ever contacted.
        </p>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={gym.whatsapp_enabled}
            disabled={disabled}
            className="mt-1 h-4 w-4 rounded border-ash text-teal focus:ring-teal"
          />
          <span>
            <span className="block text-[0.9375rem] font-semibold text-ink">
              Turn on WhatsApp for this gym
            </span>
            <span className="field-hint block">
              Off by default. Nobody is contacted over WhatsApp until this is
              checked.
            </span>
          </span>
        </label>
      </Card>

      <Card>
        <CardTitle>Approved template</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          WhatsApp requires Meta to pre-approve the exact wording of any message
          that opens a conversation. That approval happens outside casdey, in
          Twilio&apos;s Content Template Builder. Once approved, paste its
          Content SID here.
        </p>

        <div className="max-w-[24rem]">
          <label htmlFor={`${id}-template`} className="field-label">
            Template Content SID
          </label>
          <input
            id={`${id}-template`}
            name="templateName"
            defaultValue={gym.whatsapp_template_name ?? ""}
            placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            maxLength={200}
            disabled={disabled}
            className="field literal"
          />
          <p className="field-hint">
            Leave this blank if you have not had a template approved yet. You
            can turn WhatsApp on in the meantime; creating a campaign is blocked
            until this is set.
          </p>
        </div>
      </Card>

      {state.error ? (
        <p role="alert" className="notice notice-error">
          {state.error}
        </p>
      ) : null}

      {state.saved && !state.error ? (
        <p role="status" className="notice notice-info">
          Saved.
        </p>
      ) : null}

      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
      ) : null}
    </form>
  );
}
