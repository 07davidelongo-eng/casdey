"use client";

import { useActionState, useId, useState } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import {
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  PLACEHOLDER_HELP,
  composeBody,
  renderTemplate,
} from "@/lib/template";
import { monthsSince } from "@/lib/dormancy";
import { createCampaignAction, type CampaignState } from "../actions";

const INITIAL: CampaignState = { error: null };

type Sample = {
  first_name: string | null;
  last_visit_at: string | null;
} | null;

/**
 * The editor and the preview side by side.
 *
 * The preview is rendered with the very same function the sender uses, against
 * a real dormant patient from this practice's own list. Showing a made-up
 * "John Smith" would hide exactly the problems worth catching: a missing first
 * name, a patient who has been away four years, a merge field that never fills.
 */
export function CampaignForm({
  practiceName,
  replyTo,
  audienceCount,
  dailyCap,
  sample,
}: {
  practiceName: string;
  replyTo: string;
  audienceCount: number;
  dailyCap: number;
  sample: Sample;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(createCampaignAction, INITIAL);

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);

  const context = {
    firstName: sample?.first_name ?? null,
    practiceName,
    monthsAway: monthsSince(sample?.last_visit_at ?? null),
  };

  const days = Math.ceil(audienceCount / Math.max(1, dailyCap));

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardTitle>The message</CardTitle>
        <p className="mt-1 mb-5 text-[0.875rem] text-stone">
          Plain text, because that is what a letter from a dentist looks like
          and it is what stays out of the promotions tab.
        </p>

        <div className="mb-5">
          <label htmlFor={`${id}-name`} className="field-label">
            Campaign name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={120}
            disabled={pending}
            className="field"
            defaultValue="Dormant patients"
          />
          <p className="field-hint">Only you see this.</p>
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
            className="field"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor={`${id}-body`} className="field-label">
            Message
          </label>
          <textarea
            id={`${id}-body`}
            name="body"
            required
            rows={12}
            maxLength={5000}
            disabled={pending}
            className="field font-[family-name:var(--font-inter)] leading-relaxed"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="field-hint">
            <p className="mb-1">These fill themselves in:</p>
            <ul className="space-y-0.5">
              {PLACEHOLDER_HELP.map((help) => (
                <li key={help.token}>
                  <code className="literal text-graphite">{help.token}</code>{" "}
                  {help.means}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>What one patient will receive</CardTitle>
        <p className="mt-1 mb-4 text-[0.875rem] text-stone">
          {sample
            ? "Rendered against a real patient from your list, with the same code that sends it."
            : "No patient to preview against yet."}
        </p>

        <div className="rounded-[14px] border border-ash bg-paper p-5">
          <p className="literal mb-1 text-[0.75rem] text-stone">
            From: {practiceName}
          </p>
          <p className="literal mb-4 text-[0.75rem] text-stone">
            Reply-to: {replyTo}
          </p>
          <p className="mb-4 border-b border-ash pb-3 text-[0.9375rem] font-semibold text-ink">
            {renderTemplate(subject, context)}
          </p>
          <pre className="font-[family-name:var(--font-inter)] text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-graphite">
            {composeBody({
              body,
              context,
              unsubscribeUrl: "https://casdey.com/u/example",
              replyTo,
              providerCanSetReplyTo: true,
            })}
          </pre>
        </div>

        <p className="field-hint">
          The unsubscribe line is added to every message and cannot be removed.
        </p>
      </Card>

      {state.error ? (
        <p role="alert" className="notice notice-error">
          {state.error}
        </p>
      ) : null}

      <div className="card p-6">
        <p className="text-[0.9375rem] text-graphite">
          This will go to{" "}
          <span className="literal font-medium text-ink">{audienceCount}</span>{" "}
          {audienceCount === 1 ? "patient" : "patients"}, spread over{" "}
          <span className="literal font-medium text-ink">{days}</span>{" "}
          {days === 1 ? "day" : "days"} at {dailyCap} a day.{" "}
          <strong className="font-semibold text-ink">
            Nothing sends until you approve it on the next screen.
          </strong>
        </p>
        <Button type="submit" disabled={pending} className="mt-4">
          {pending ? "Saving" : "Save as draft"}
        </Button>
      </div>
    </form>
  );
}
