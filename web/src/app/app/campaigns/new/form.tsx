"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import { Button, Card, CardTitle, Notice } from "@/components/app/ui";
import {
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  PLACEHOLDER_HELP,
  composeBody,
  renderTemplate,
} from "@/lib/template";
import { monthsSince } from "@/lib/dormancy";
import { LANGUAGES } from "@/lib/languages";
import type { Channel } from "@/lib/types";
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
 *
 * WhatsApp has no equivalent editor: Meta requires an approved template for
 * any business-initiated first contact, so there is nothing to write here.
 * The channel selector swaps the whole email-specific card stack for a
 * read-only summary of the configured template instead.
 */
export function CampaignForm({
  practiceName,
  replyTo,
  emailAudienceCount,
  whatsappAudienceCount,
  dailyCap,
  emailSample,
  defaultLanguage,
  whatsappEnabled,
  whatsappTemplateName,
}: {
  practiceName: string;
  replyTo: string;
  emailAudienceCount: number;
  whatsappAudienceCount: number;
  dailyCap: number;
  emailSample: Sample;
  defaultLanguage: string;
  whatsappEnabled: boolean;
  whatsappTemplateName: string | null;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(createCampaignAction, INITIAL);

  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [language, setLanguage] = useState(defaultLanguage);

  const context = {
    firstName: emailSample?.first_name ?? null,
    practiceName,
    monthsAway: monthsSince(emailSample?.last_visit_at ?? null),
  };

  const audienceCount = channel === "whatsapp" ? whatsappAudienceCount : emailAudienceCount;
  const days = Math.ceil(audienceCount / Math.max(1, dailyCap));
  const whatsappReady = whatsappEnabled && Boolean(whatsappTemplateName);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="channel" value={channel} />

      <Card>
        <CardTitle>Channel</CardTitle>
        <p className="mt-1 mb-5 text-[0.875rem] text-stone">
          Email is a message you write yourself. WhatsApp opens with a
          pre-approved template, then casdey&apos;s assistant carries the
          conversation from there.
        </p>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Channel">
          <ChannelOption
            label="Email"
            hint={`${emailAudienceCount} ${emailAudienceCount === 1 ? "patient matches" : "patients match"}`}
            active={channel === "email"}
            disabled={pending}
            onSelect={() => setChannel("email")}
          />
          <ChannelOption
            label="WhatsApp"
            hint={`${whatsappAudienceCount} ${whatsappAudienceCount === 1 ? "patient matches" : "patients match"}`}
            active={channel === "whatsapp"}
            disabled={pending}
            onSelect={() => setChannel("whatsapp")}
          />
        </div>
      </Card>

      {channel === "whatsapp" ? (
        <>
          {!whatsappReady ? (
            <Notice tone="warn">
              <span>
                {!whatsappEnabled
                  ? "WhatsApp is not turned on for this practice yet."
                  : "No approved WhatsApp template is configured yet."}{" "}
                Set it up from Settings before creating a WhatsApp campaign.
              </span>
              <Link
                href="/app/settings/whatsapp"
                className="text-[0.9375rem] font-semibold text-teal hover:text-teal-hover"
              >
                Go to WhatsApp settings
              </Link>
            </Notice>
          ) : null}

          <Card>
            <CardTitle>Campaign name</CardTitle>
            <div className="mt-4">
              <label htmlFor={`${id}-wa-name`} className="field-label">
                Campaign name
              </label>
              <input
                id={`${id}-wa-name`}
                name="name"
                required
                maxLength={120}
                disabled={pending}
                className="field"
                defaultValue="Dormant patients (WhatsApp)"
              />
              <p className="field-hint">Only you see this.</p>
            </div>
          </Card>

          <Card>
            <CardTitle>The opening message</CardTitle>
            <p className="mt-1 mb-4 text-[0.875rem] text-stone">
              This is the template approved by Meta for your practice. It
              cannot be edited here: WhatsApp requires business-initiated
              first contact to use an approved template, exactly, word for
              word.
            </p>
            <div className="rounded-[14px] border border-ash bg-paper p-5">
              <p className="literal text-[0.8125rem] text-stone">
                Template: {whatsappTemplateName ?? "not configured"}
              </p>
            </div>
            <p className="field-hint">
              Once a patient replies, casdey&apos;s assistant carries the
              conversation freely and hands off to you the moment they show
              interest in booking. You can test the whole thing on your own
              WhatsApp before approving.
            </p>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardTitle>The language</CardTitle>
            <p className="mt-1 mb-5 text-[0.875rem] text-stone">
              Start from our template below and edit it to fit. You review
              every word before anything sends.
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
                The message goes out in this language. Defaulted from your
                country.
              </p>
            </div>
          </Card>

          <Card>
            <CardTitle>The message</CardTitle>
            <p className="mt-1 mb-5 text-[0.875rem] text-stone">
              Plain text, because that is what a letter from a dentist looks
              like and it is what stays out of the promotions tab.
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
              {emailSample
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
              The unsubscribe line is added to every message and cannot be
              removed.
            </p>
          </Card>
        </>
      )}

      {state.error ? (
        <p role="alert" className="notice notice-error">
          {state.error}
        </p>
      ) : null}

      <div className="card p-6">
        <p className="text-[0.9375rem] text-graphite">
          This will go to{" "}
          <span className="literal font-medium text-ink">{audienceCount}</span>{" "}
          {audienceCount === 1 ? "patient" : "patients"}
          {channel === "email" ? (
            <>
              , spread over{" "}
              <span className="literal font-medium text-ink">{days}</span>{" "}
              {days === 1 ? "day" : "days"} at {dailyCap} a day
            </>
          ) : (
            " in one batch"
          )}
          .{" "}
          <strong className="font-semibold text-ink">
            Nothing sends until you approve it on the next screen.
          </strong>
        </p>
        <Button
          type="submit"
          disabled={pending || (channel === "whatsapp" && !whatsappReady)}
          className="mt-4"
        >
          {pending ? "Saving" : "Save as draft"}
        </Button>
      </div>
    </form>
  );
}

function ChannelOption({
  label,
  hint,
  active,
  disabled,
  onSelect,
}: {
  label: string;
  hint: string;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={`rounded-[12px] border px-4 py-3 text-left transition-colors duration-200 disabled:opacity-55 ${
        active
          ? "border-teal bg-teal/5"
          : "border-ash hover:border-stone"
      }`}
    >
      <p className={`text-[0.9375rem] font-semibold ${active ? "text-teal" : "text-ink"}`}>
        {label}
      </p>
      <p className="literal text-[0.75rem] text-stone">{hint}</p>
    </button>
  );
}
