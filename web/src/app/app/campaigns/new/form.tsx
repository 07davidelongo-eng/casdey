"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import {
  DEFAULT_AT_RISK_BODY,
  DEFAULT_AT_RISK_SUBJECT,
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  PLACEHOLDER_HELP,
  composeBody,
  renderTemplate,
} from "@/lib/template";
import { monthsSince } from "@/lib/lapse";
import { REASON_OPTIONS } from "@/lib/cancellation";
import { LANGUAGES } from "@/lib/languages";
import { createCampaignAction, type CampaignState } from "../actions";
import type { CampaignKind } from "@/lib/types";

const INITIAL: CampaignState = { error: null };

type Sample = {
  first_name: string | null;
  last_visit_at: string | null;
  cancellation_reason: string | null;
} | null;

/**
 * The editor and the preview side by side.
 *
 * The preview is rendered with the very same function the sender uses, against
 * a real member from this gym's own list, matching whichever kind is
 * selected. Showing a made-up "John Smith" would hide exactly the problems
 * worth catching: a missing first name, a member who has been away four
 * years, a merge field that never fills.
 */
export function CampaignForm({
  gymName,
  replyTo,
  winBackAudienceCount,
  atRiskAudienceCount,
  dailyCap,
  winBackSample,
  atRiskSample,
  winBackSampleBookingUrl,
  atRiskSampleBookingUrl,
  defaultLanguage,
}: {
  gymName: string;
  replyTo: string;
  winBackAudienceCount: number;
  atRiskAudienceCount: number;
  dailyCap: number;
  winBackSample: Sample;
  atRiskSample: Sample;
  /** The sample member's real booking link, or null when booking is off.
   *  Computed server-side because it needs siteUrl(), which is server-only. */
  winBackSampleBookingUrl: string | null;
  atRiskSampleBookingUrl: string | null;
  defaultLanguage: string;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(createCampaignAction, INITIAL);

  const [kind, setKind] = useState<CampaignKind>("win_back");
  const [reasonFilter, setReasonFilter] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [bodyTouched, setBodyTouched] = useState(false);
  const [language, setLanguage] = useState(defaultLanguage);

  function selectKind(next: CampaignKind) {
    setKind(next);
    if (next === "at_risk") {
      setReasonFilter("");
      if (!subjectTouched) setSubject(DEFAULT_AT_RISK_SUBJECT);
      if (!bodyTouched) setBody(DEFAULT_AT_RISK_BODY);
    } else {
      if (!subjectTouched) setSubject(DEFAULT_SUBJECT);
      if (!bodyTouched) setBody(DEFAULT_BODY);
    }
  }

  const sample = kind === "at_risk" ? atRiskSample : winBackSample;
  const sampleBookingUrl =
    kind === "at_risk" ? atRiskSampleBookingUrl : winBackSampleBookingUrl;

  const context = useMemo(
    () => ({
      firstName: sample?.first_name ?? null,
      gymName,
      monthsAway: monthsSince(sample?.last_visit_at ?? null),
      bookingUrl: sampleBookingUrl,
      reason: sample?.cancellation_reason
        ? (REASON_OPTIONS.find((o) => o.value === sample.cancellation_reason)
            ?.label ?? null)
        : null,
    }),
    [sample, gymName, sampleBookingUrl],
  );

  const audienceCount =
    kind === "at_risk" ? atRiskAudienceCount : winBackAudienceCount;
  const days = Math.ceil(audienceCount / Math.max(1, dailyCap));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="kind" value={kind} />
      {kind === "win_back" && reasonFilter ? (
        <input type="hidden" name="reasonFilter" value={reasonFilter} />
      ) : null}

      <Card>
        <CardTitle>Who this reaches</CardTitle>
        <p className="mt-1 mb-5 text-[0.875rem] text-stone">
          Two different jobs: winning back people who have already gone quiet
          or cancelled, or checking in with members before that happens.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => selectKind("win_back")}
            disabled={pending}
            aria-pressed={kind === "win_back"}
            className={`rounded-[14px] border p-4 text-left transition-colors ${
              kind === "win_back"
                ? "border-teal bg-shallow"
                : "border-ash bg-white hover:border-stone"
            }`}
          >
            <p className="font-semibold text-ink">Win them back</p>
            <p className="mt-1 text-[0.8125rem] text-stone">
              Members who have gone quiet, or told you they cancelled.
            </p>
          </button>
          <button
            type="button"
            onClick={() => selectKind("at_risk")}
            disabled={pending}
            aria-pressed={kind === "at_risk"}
            className={`rounded-[14px] border p-4 text-left transition-colors ${
              kind === "at_risk"
                ? "border-teal bg-shallow"
                : "border-ash bg-white hover:border-stone"
            }`}
          >
            <p className="font-semibold text-ink">Check in early</p>
            <p className="mt-1 text-[0.8125rem] text-stone">
              Still-active members whose visits have gone quiet, before they
              cancel.
            </p>
          </button>
        </div>

        {kind === "win_back" ? (
          <div className="mt-5 max-w-[18rem]">
            <label htmlFor={`${id}-reason`} className="field-label">
              Only members who left because of
            </label>
            <select
              id={`${id}-reason`}
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value)}
              disabled={pending}
              className="field"
            >
              <option value="">Any reason</option>
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="field-hint">
              Optional. Narrows to members recorded with that reason, so you
              can write to it directly.
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardTitle>The language</CardTitle>
        <p className="mt-1 mb-5 text-[0.875rem] text-stone">
          Start from our template below and edit it to fit. You review every
          word before anything sends.
        </p>

        <div className="max-w-[18rem]">
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
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <p className="field-hint">
            The message goes out in this language. Defaulted from your country.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>The message</CardTitle>
        <p className="mt-1 mb-5 text-[0.875rem] text-stone">
          Plain text, because that is what a note from a gym looks like and it
          is what stays out of the promotions tab.
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
            defaultValue={kind === "at_risk" ? "Check in early" : "Lapsed members"}
            key={kind}
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
            onChange={(event) => {
              setSubjectTouched(true);
              setSubject(event.target.value);
            }}
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
            onChange={(event) => {
              setBodyTouched(true);
              setBody(event.target.value);
            }}
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
        <CardTitle>What one member will receive</CardTitle>
        <p className="mt-1 mb-4 text-[0.875rem] text-stone">
          {sample
            ? "Rendered against a real member from your list, with the same code that sends it."
            : "No member to preview against yet."}
        </p>

        <div className="rounded-[14px] border border-ash bg-paper p-5">
          <p className="literal mb-1 text-[0.75rem] text-stone">
            From: {gymName}
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
          {audienceCount === 1 ? "member" : "members"}, spread over{" "}
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
