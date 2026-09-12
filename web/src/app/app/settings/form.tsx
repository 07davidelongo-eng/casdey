"use client";

import { useActionState, useId, useState } from "react";

import { Button, Card, CardTitle, Notice } from "@/components/app/ui";
import type { LapsePreviewRow } from "@/lib/lapse-preview";
import type { Gym } from "@/lib/types";
import { saveSettingsAction, type SettingsState } from "./actions";

const INITIAL: SettingsState = { error: null, saved: false };

/**
 * The gym's persisted window as a phrase, e.g. "90 days" or "12 months".
 *
 * Deliberately the saved values and not the form's live state: this sentence
 * describes what casdey is counting with right now, which is what makes it
 * worth reading. describeRule() in src/lib/lapse.ts is the fuller sentence and
 * includes the visit ceiling; this one is only the window, because the
 * ceiling is a separate control sitting beside it.
 */
function describeWindow(gym: Gym): string {
  const value = gym.lapsed_after_days ?? gym.lapsed_after_months;
  const unit = gym.lapsed_after_days != null ? "days" : "months";
  return `${value} ${value === 1 ? unit.slice(0, -1) : unit}`;
}

export function SettingsForm({
  gym,
  readOnly,
  ruleChosen,
  preview,
}: {
  gym: Gym;
  readOnly: boolean;
  /** The gym has deliberately saved its lapse rule at least once. */
  ruleChosen: boolean;
  /** What each candidate window catches, or null when there is nothing to
   *  count yet. */
  preview: LapsePreviewRow[] | null;
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

  /**
   * When a save lands, the derived state above is describing the old row.
   *
   * Adjusting state during render is React's own answer to a prop change that
   * invalidates derived state: it runs before anything paints, so there is no
   * flash of the stale value. Re-mounting the whole form would also fix it
   * and would take the action's result with it, which is exactly what once
   * hid the "Saved." message.
   */
  const persisted = `${gym.lapsed_after_months}:${gym.lapsed_after_days}:${gym.max_visits}`;
  const [lastPersisted, setLastPersisted] = useState(persisted);
  if (persisted !== lastPersisted) {
    setLastPersisted(persisted);
    setUnit(gym.lapsed_after_days != null ? "days" : "months");
    setWindowValue(String(gym.lapsed_after_days ?? gym.lapsed_after_months));
    setCapVisits(gym.max_visits != null);
  }

  /**
   * Why this form refuses the reset React fires after an action.
   *
   * That reset moves the DOM somewhere React cannot see. Three controls here
   * are drawn from state, and a controlled `<select>` carries its choice as a
   * property rather than a `selected` attribute, so a reset drops it back to
   * the first option, which is "months". State still says "days", so no
   * setter changes anything, React re-renders nothing, and the select keeps
   * showing a unit the gym did not pick: saving "90 days" left the form
   * reading "90 months", one Save away from submitting a window nobody chose.
   * The visit-ceiling checkbox has the same shape, and used to tick itself
   * back on for the same reason. Since the number field beside it is disabled
   * while the box is off, and a disabled field is never submitted, the next
   * save then reported a ceiling out of range that the gym had never typed.
   *
   * Re-syncing state on the reset event cannot fix any of this, and that is
   * measured rather than assumed: by the time the reset fires, the new row
   * has already arrived and state already matches it, so every setter is a
   * no-op and the DOM keeps what the reset put there.
   *
   * Refusing the reset is the fix, and the event is cancelable. Nothing is
   * lost by refusing: after a successful save the fields already hold exactly
   * what was saved, and after a failed one the gym keeps what it typed
   * instead of having it wiped.
   */
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      data-unsaved-guard
      className="space-y-6"
    >
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

        {/* The gym's own window, not the shipped default. A gym that predates
            0037 still carries whatever it inherited, and telling it casdey is
            using 90 days when the counts on its dashboard come from 12 months
            would be worse than saying nothing. */}
        {!ruleChosen && !readOnly ? (
          <div className="mb-5">
            <Notice tone="warn">
              You have not set this yet, so casdey is using its own guess:{" "}
              <span className="literal">
                {describeWindow(gym)}
              </span>
              . Pick the window that matches how your gym works and save it.
            </Notice>
          </div>
        ) : null}

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

        {/* What the window actually costs, in their own members.
            The number above is impossible to judge on its own: its
            consequence, how many people casdey writes to, lives on another
            page. That is most of how a 12-month dental default went a month
            without anyone questioning it. See src/lib/lapse-preview.ts. */}
        {preview ? (
          <div className="mt-6">
            <p className="label mb-2 text-stone">Your members, by window</p>
            <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-ash">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No visit for</th>
                    <th>Lapsed</th>
                    <th>Can email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={`${row.window.value}-${row.window.unit}`}>
                      <td
                        className={
                          row.current
                            ? "literal font-medium text-ink"
                            : "literal"
                        }
                      >
                        {row.label}
                      </td>
                      <td className="literal">{row.lapsed}</td>
                      <td className="literal">{row.reachable}</td>
                      <td className="text-right">
                        {row.current ? (
                          <span className="label text-stone">In use</span>
                        ) : disabled ? null : (
                          <button
                            type="button"
                            onClick={() => {
                              setUnit(row.window.unit);
                              setWindowValue(String(row.window.value));
                            }}
                            className="text-[0.8125rem] text-teal underline-offset-2 hover:underline"
                          >
                            Use this
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="field-hint">
              Counted against your list right now, with your visit limit as it
              is set above. Choosing a window here fills in the field, and
              nothing changes until you save.
            </p>
          </div>
        ) : null}

        {/* The control stays narrow, the sentence does not. Capping the whole
            block at 16rem stacked five lines of explanation into a column
            beside an empty half of the card. */}
        <div className="mt-5">
          <label htmlFor={`${id}-at-risk`} className="field-label">
            Check in after
          </label>
          <div className="flex max-w-[16rem] items-center gap-3">
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
