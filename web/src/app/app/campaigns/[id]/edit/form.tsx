"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import { Button, Card, CardTitle } from "@/components/app/ui";
import { MessageEditor } from "@/components/app/message-editor";
import { LANGUAGES } from "@/lib/languages";
import {
  MAX_FOLLOW_UPS,
  MAX_FOLLOW_UP_DAYS,
  MIN_FOLLOW_UP_DAYS,
  type FollowUp,
} from "@/lib/follow-ups";
import { defaultFollowUpsFor } from "@/lib/templates-i18n";
import { updateCampaignAction, type CampaignState } from "../../actions";
import type { CampaignKind } from "@/lib/types";

const INITIAL: CampaignState = { error: null };

/**
 * Editing a draft.
 *
 * Deliberately narrower than the create form: no channel, no kind, no reason
 * filter and no audience preview, because those decided who this campaign is
 * for and that was frozen onto the row when it was created. Changing them is a
 * different campaign, and making a new one costs nothing.
 *
 * Everything a gym would actually want to fix after reading its own draft back
 * is here: the wording, the subject, the language, whether casdey writes each
 * message, and the follow-up sequence.
 */
export function EditCampaignForm({
  campaignId,
  initial,
  kind,
}: {
  campaignId: string;
  initial: {
    name: string;
    subject: string;
    body: string;
    language: string;
    personalise: boolean;
    followUps: FollowUp[];
  };
  kind: CampaignKind;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(updateCampaignAction, INITIAL);

  const [body, setBody] = useState(initial.body);
  const [language, setLanguage] = useState(initial.language);
  const [personalise, setPersonalise] = useState(initial.personalise);
  const [followUps, setFollowUps] = useState<FollowUp[]>(initial.followUps);

  function updateFollowUp(index: number, patch: Partial<FollowUp>) {
    setFollowUps((steps) =>
      steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  }

  return (
    <form action={action} data-unsaved-guard className="space-y-6">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="followUps" value={JSON.stringify(followUps)} />

      <Card>
        <CardTitle>The message</CardTitle>

        <div className="mt-5 mb-5">
          <label htmlFor={`${id}-name`} className="field-label">
            Campaign name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={120}
            disabled={pending}
            defaultValue={initial.name}
            className="field"
          />
          <p className="field-hint">Only you see this.</p>
        </div>

        <div className="mb-5 max-w-[16rem]">
          <label htmlFor={`${id}-language`} className="field-label">
            Language
          </label>
          <select
            id={`${id}-language`}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            disabled={pending}
            className="field"
          >
            {LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          {/* Unlike the create form, changing the language here does NOT
              rewrite the draft. By this point the gym has words it chose, and
              replacing them because a dropdown moved would throw away work. */}
          <p className="field-hint">
            Your wording below stays as it is. This sets the language casdey
            writes in when it writes each message individually.
          </p>
        </div>

        <div className="mb-5">
          <label htmlFor={`${id}-subject`} className="field-label">
            Subject
          </label>
          <input
            id={`${id}-subject`}
            name="subject"
            required
            maxLength={200}
            disabled={pending}
            defaultValue={initial.subject}
            className="field"
          />
        </div>

        <div>
          <label htmlFor={`${id}-body`} className="field-label">
            Message
          </label>
          <MessageEditor
            id={`${id}-body`}
            name="body"
            required
            disabled={pending}
            value={body}
            onChange={setBody}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>One message, or one each</CardTitle>
        <label className="mt-4 flex items-start gap-2.5 text-[0.9375rem] text-ink">
          <input
            type="checkbox"
            name="personalise"
            checked={personalise}
            onChange={(event) => setPersonalise(event.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4 accent-[var(--teal)]"
          />
          <span>
            Write each message individually
            <span className="mt-1 block text-[0.875rem] text-stone">
              casdey writes every member their own version, from this draft and
              what it knows about them.
            </span>
          </span>
        </label>
      </Card>

      <Card>
        <CardTitle>If nobody answers</CardTitle>
        <p className="mt-1 mb-5 text-[0.875rem] text-stone">
          Each of these goes out only if the member has not booked by then, and
          the sequence stops the moment they do.
        </p>

        {followUps.map((step, index) => (
          <div
            key={index}
            className="mb-5 border-t border-ash pt-5 first:border-t-0 first:pt-0"
          >
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-[0.9375rem] text-ink">
                Follow-up {index + 1}, after
              </span>
              <input
                type="number"
                min={MIN_FOLLOW_UP_DAYS}
                max={MAX_FOLLOW_UP_DAYS}
                value={step.afterDays}
                disabled={pending}
                onChange={(event) =>
                  updateFollowUp(index, {
                    afterDays: Number(event.target.value),
                  })
                }
                className="field literal w-20"
                aria-label={`Follow-up ${index + 1} delay in days`}
              />
              <span className="text-[0.9375rem] text-stone">
                days with no booking
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  setFollowUps((steps) => steps.filter((_, i) => i !== index))
                }
                className="ml-auto text-[0.875rem] text-stone underline underline-offset-4 hover:text-ink"
              >
                Remove
              </button>
            </div>

            <input
              type="text"
              value={step.subject}
              maxLength={200}
              disabled={pending}
              onChange={(event) =>
                updateFollowUp(index, { subject: event.target.value })
              }
              className="field mb-3"
              aria-label={`Follow-up ${index + 1} subject`}
            />

            <MessageEditor
              rows={7}
              showLegend={false}
              disabled={pending}
              value={step.body}
              onChange={(next) => updateFollowUp(index, { body: next })}
            />
          </div>
        ))}

        {followUps.length < MAX_FOLLOW_UPS ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              setFollowUps((steps) => [
                ...steps,
                defaultFollowUpsFor(language, kind)[steps.length] ?? {
                  afterDays: 7,
                  subject: "Following up",
                  body: `Hi {{first_name}},\n\nJust following up on my last message.\n\n{{gym}}`,
                },
              ])
            }
            className="text-[0.875rem] text-teal underline underline-offset-4"
          >
            Add a follow-up
          </button>
        ) : (
          <p className="text-[0.8125rem] text-stone">
            Two is the most casdey will send.
          </p>
        )}
      </Card>

      {state.error ? <p className="notice notice-warn">{state.error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
        <Link
          href={`/app/campaigns/${campaignId}`}
          className="text-[0.9375rem] text-stone underline underline-offset-4 hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
