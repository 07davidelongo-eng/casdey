"use client";

import { useActionState, useId } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import type { Practice } from "@/lib/types";
import { saveSettingsAction, type SettingsState } from "./actions";

const INITIAL: SettingsState = { error: null, saved: false };

export function SettingsForm({
  practice,
  readOnly,
}: {
  practice: Practice;
  readOnly: boolean;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(saveSettingsAction, INITIAL);
  const disabled = readOnly || pending;

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardTitle>How patients see you</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          casdey sends on your behalf. This is the name and address a patient
          sees.
        </p>

        <div className="mb-5">
          <label htmlFor={`${id}-name`} className="field-label">
            Practice name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            defaultValue={practice.name}
            required
            maxLength={200}
            disabled={disabled}
            className="field"
          />
        </div>

        <div className="mb-5">
          <label htmlFor={`${id}-sender`} className="field-label">
            Sender name
          </label>
          <input
            id={`${id}-sender`}
            name="senderName"
            defaultValue={practice.sender_name ?? practice.name}
            required
            maxLength={120}
            disabled={disabled}
            className="field"
          />
          <p className="field-hint">
            What appears in the patient&apos;s inbox. Usually your practice
            name.
          </p>
        </div>

        <div>
          <label htmlFor={`${id}-reply`} className="field-label">
            Where replies go
          </label>
          <input
            id={`${id}-reply`}
            name="replyToEmail"
            type="email"
            defaultValue={practice.reply_to_email ?? practice.contact_email}
            required
            maxLength={320}
            disabled={disabled}
            className="field"
          />
          <p className="field-hint">
            A patient replying to book lands here. Watch this inbox.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>What counts as dormant</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          casdey looks for patients who came a few times and then stopped. These
          two numbers decide who that is. Changing them changes every count in
          the app straight away.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-months`} className="field-label">
              No visit for at least
            </label>
            <div className="flex items-center gap-3">
              <input
                id={`${id}-months`}
                name="dormantAfterMonths"
                type="number"
                min={3}
                max={60}
                step={1}
                defaultValue={practice.dormant_after_months}
                required
                disabled={disabled}
                className="field literal"
              />
              <span className="text-[0.9375rem] text-graphite">months</span>
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-visits`} className="field-label">
              And came at most
            </label>
            <div className="flex items-center gap-3">
              <input
                id={`${id}-visits`}
                name="maxVisits"
                type="number"
                min={1}
                max={20}
                step={1}
                defaultValue={practice.max_visits}
                required
                disabled={disabled}
                className="field literal"
              />
              <span className="text-[0.9375rem] text-graphite">times</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Sending pace</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          casdey spreads a campaign out rather than sending it all at once. A
          few hundred identical emails leaving in one minute is what gets a
          domain filtered.
        </p>

        <div className="max-w-[16rem]">
          <label htmlFor={`${id}-cap`} className="field-label">
            Most emails per day
          </label>
          <input
            id={`${id}-cap`}
            name="dailySendCap"
            type="number"
            min={1}
            max={1000}
            step={1}
            defaultValue={practice.daily_send_cap}
            required
            disabled={disabled}
            className="field literal"
          />
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
