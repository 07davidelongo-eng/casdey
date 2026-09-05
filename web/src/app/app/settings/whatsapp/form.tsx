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
        <CardTitle>Your own WhatsApp number</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          Messages go out from your gym&apos;s own WhatsApp Business number, not
          from casdey. That matters more on WhatsApp than anywhere else: the
          business name your members see is attached to the number itself, so
          this is the only way a lapsed member sees your gym rather than a
          company they have never heard of.
        </p>

        <div className="mb-5 max-w-[24rem]">
          <label htmlFor={`${id}-from`} className="field-label">
            WhatsApp sender number
          </label>
          <input
            id={`${id}-from`}
            name="whatsappFrom"
            defaultValue={gym.whatsapp_from ?? ""}
            placeholder="+353 87 123 4567"
            disabled={disabled}
            className="field literal"
            inputMode="tel"
          />
          <p className="field-hint">
            The number registered to your WhatsApp Business account, in full
            international format. It cannot be a number already used for a
            personal WhatsApp account. Leave blank until yours is connected.
          </p>
        </div>

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
          Twilio&apos;s Content Template Builder, and it is granted against your
          own WhatsApp Business account, so it is yours rather than something
          casdey can share out. Once approved, paste its Content SID here.
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
            Your template must contain{" "}
            <strong className="text-ink">exactly one variable</strong>,{" "}
            <code className="literal">{"{{1}}"}</code>, which casdey fills with
            your gym&apos;s name. A template with none, or with more than one,
            is rejected the moment casdey tries to send it, and a replacement
            takes days to get approved. Worth checking before you submit it to
            Meta rather than after.
          </p>
          <p className="field-hint mt-2">
            Leave this blank if you have not had a template approved yet. You
            can turn WhatsApp on in the meantime; creating a campaign is
            blocked until this is set.
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
