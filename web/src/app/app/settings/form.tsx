"use client";

import { useActionState, useId, useState } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import type { Gym } from "@/lib/types";
import { saveSettingsAction, type SettingsState } from "./actions";

const INITIAL: SettingsState = { error: null, saved: false };

export function SettingsForm({
  gym,
  readOnly,
}: {
  gym: Gym;
  readOnly: boolean;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(saveSettingsAction, INITIAL);
  const disabled = readOnly || pending;

  // The window is one number and a unit, not two fields. Which column it
  // lands in is ruleFor()'s problem (src/lib/lapse.ts), not the gym's.
  const [unit, setUnit] = useState<"months" | "days">(
    gym.lapsed_after_days != null ? "days" : "months",
  );
  const [windowValue, setWindowValue] = useState(
    String(gym.lapsed_after_days ?? gym.lapsed_after_months),
  );
  const [capVisits, setCapVisits] = useState(gym.max_visits != null);

  return (
    <form action={action} data-unsaved-guard className="space-y-6">
      <Card>
        <CardTitle>How members see you</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          casdey sends on your behalf. This is the name and address a member
          sees.
        </p>

        <div className="mb-5">
          <label htmlFor={`${id}-name`} className="field-label">
            Gym name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            defaultValue={gym.name}
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
            defaultValue={gym.sender_name ?? gym.name}
            required
            maxLength={120}
            disabled={disabled}
            className="field"
          />
          <p className="field-hint">
            What appears in the member&apos;s inbox. Usually your gym
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
            defaultValue={gym.reply_to_email ?? gym.contact_email}
            required
            maxLength={320}
            disabled={disabled}
            className="field"
          />
          <p className="field-hint">
            A member replying to book lands here. Watch this inbox.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>What counts as lapsed</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          casdey looks for members who stopped coming. This is where you say
          what that means at your gym. Changing it changes every count in the
          app straight away.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-window`} className="field-label">
              No visit for at least
            </label>
            <div className="flex items-center gap-3">
              <input
                id={`${id}-window`}
                name="lapseWindow"
                type="number"
                min={1}
                max={unit === "days" ? 1825 : 60}
                step={1}
                value={windowValue}
                onChange={(e) => setWindowValue(e.target.value)}
                required
                disabled={disabled}
                className="field literal"
              />
              <select
                name="lapseUnit"
                aria-label="Window unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as "months" | "days")}
                disabled={disabled}
                className="field w-auto"
              >
                <option value="months">months</option>
                <option value="days">days</option>
              </select>
            </div>
            <p className="field-hint">
              Months for a rolling membership. Days if you sell class packs and
              know someone is gone after six weeks.
            </p>
          </div>

          <div>
            {/* A ceiling is right for a gym whose win-back is aimed at people
                who tried the place and drifted, and wrong for one that wants
                to write to everyone who stopped, regulars included. It is a
                choice, so it is a switch. */}
            <label className="flex items-center gap-2.5 text-[0.9375rem] text-ink">
              <input
                type="checkbox"
                name="capVisits"
                checked={capVisits}
                onChange={(e) => setCapVisits(e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 accent-[var(--teal)]"
              />
              And they came at most
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id={`${id}-visits`}
                name="maxVisits"
                type="number"
                min={1}
                max={200}
                step={1}
                defaultValue={gym.max_visits ?? 2}
                required={capVisits}
                disabled={disabled || !capVisits}
                className="field literal"
              />
              <span className="text-[0.9375rem] text-graphite">times</span>
            </div>
            <p className="field-hint">
              {capVisits
                ? "Long-standing regulars are left out of win-back. Check-ins ignore this either way."
                : "Off: everyone who stopped counts, however many times they came."}
            </p>
          </div>
        </div>

        <div className="mt-5 max-w-[16rem]">
          <label htmlFor={`${id}-at-risk`} className="field-label">
            Check in after
          </label>
          <div className="flex items-center gap-3">
            <input
              id={`${id}-at-risk`}
              name="atRiskAfterDays"
              type="number"
              min={7}
              max={180}
              step={1}
              defaultValue={gym.at_risk_after_days}
              required
              disabled={disabled}
              className="field literal"
            />
            <span className="text-[0.9375rem] text-graphite">days</span>
          </div>
          <p className="field-hint">
            A still-active member who has not been in this long gets a gentler
            check-in campaign, before they count as lapsed. Keep it shorter
            than the lapse window above. The visit limit does not apply here:
            a regular who goes quiet is worth checking on however many times
            they have been in.
          </p>
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
            defaultValue={gym.daily_send_cap}
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
