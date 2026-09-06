"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import { MessageEditor } from "@/components/app/message-editor";
import { composeBody, renderTemplate } from "@/lib/template";
import { defaultFollowUpsFor, defaultMessage } from "@/lib/templates-i18n";
import { monthsSince } from "@/lib/lapse";
import {
  MAX_FOLLOW_UPS,
  MAX_FOLLOW_UP_DAYS,
  MIN_FOLLOW_UP_DAYS,
  type FollowUp,
} from "@/lib/follow-ups";
import type { ResolvedReason } from "@/lib/cancellation";
import { LANGUAGES } from "@/lib/languages";
import { createCampaignAction, type CampaignState } from "../actions";
import type { CampaignKind, Channel } from "@/lib/types";

const INITIAL: CampaignState = { error: null };

type Sample = {
  first_name: string | null;
  last_visit_at: string | null;
  cancellation_reason: string | null;
  /** Computed server-side: offerCode() hashes the booking token, and the
   *  browser has no business holding either. */
  offer_code: string | null;
} | null;

/**
 * The editor and the preview side by side.
 *
 * The preview is rendered with the very same function the sender uses, against
 * a real member from this gym's own list, matching whichever kind is
 * selected. Showing a made-up "John Smith" would hide exactly the problems
 * worth catching: a missing first name, a member who has been away four
 * years, a merge field that never fills.
 *
 * A WhatsApp campaign has no freeform first-contact copy (Meta requires a
 * pre-approved template), so the subject / message / preview cards are
 * replaced by a short explainer and the send is the template opener. The
 * back-and-forth after a reply is casdey's assistant, not this form.
 */
export function CampaignForm({
  gymName,
  replyTo,
  winBackAudienceCount,
  atRiskAudienceCount,
  whatsAppAudienceCount,
  dailyCap,
  winBackSample,
  atRiskSample,
  winBackSampleBookingUrl,
  atRiskSampleBookingUrl,
  defaultLanguage,
  whatsAppEnabled,
  whatsAppTemplateSet,
  offerText,
  reasonCounts,
  reasons,
}: {
  gymName: string;
  replyTo: string;
  winBackAudienceCount: number;
  atRiskAudienceCount: number;
  whatsAppAudienceCount: number;
  dailyCap: number;
  winBackSample: Sample;
  atRiskSample: Sample;
  /** The sample member's real booking link, or null when booking is off.
   *  Computed server-side because it needs siteUrl(), which is server-only. */
  winBackSampleBookingUrl: string | null;
  atRiskSampleBookingUrl: string | null;
  defaultLanguage: string;
  /** Settings -> WhatsApp: the gym has turned the channel on. */
  whatsAppEnabled: boolean;
  /** ...and pasted an approved template Content SID. Both are required before
   *  a WhatsApp campaign can be created. */
  whatsAppTemplateSet: boolean;
  /** The gym's chosen win-back offer, already dated. Powers {{offer}} in the
   *  preview so the gym sees exactly what a member will read. */
  offerText: string | null;
  /** How many contactable members carry each reason for leaving. Drives the
   *  counts on the reason filter, so a gym is never offered a choice that
   *  can only build an empty audience. */
  reasonCounts: Record<string, number>;
  /** casdey's six plus this gym's own (#33). */
  reasons: ResolvedReason[];
}) {
  const id = useId();
  const [state, action, pending] = useActionState(createCampaignAction, INITIAL);

  const [channel, setChannel] = useState<Channel>("email");
  const [kind, setKind] = useState<CampaignKind>("win_back");
  const [reasonFilter, setReasonFilter] = useState("");
  const anyReasonRecorded = Object.values(reasonCounts).some((n) => n > 0);
  const [subject, setSubject] = useState(
    () => defaultMessage(defaultLanguage, "win_back").subject,
  );
  const [body, setBody] = useState(
    () => defaultMessage(defaultLanguage, "win_back").body,
  );
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [bodyTouched, setBodyTouched] = useState(false);
  const [language, setLanguage] = useState(defaultLanguage);
  const [followUps, setFollowUps] = useState<FollowUp[]>(() =>
    defaultFollowUpsFor(defaultLanguage, "win_back"),
  );
  const [followUpsTouched, setFollowUpsTouched] = useState(false);
  const [personalise, setPersonalise] = useState(true);

  const isWhatsApp = channel === "whatsapp";

  /**
   * casdey's suggestion follows whichever kind and language are selected, right
   * up until the gym edits a field, and from then on that field is theirs. One
   * function for both, because the rule is the same and having it in two places
   * is how the language selector came to change the campaign's language without
   * changing a word of the draft underneath it.
   */
  function applyDefaults(nextKind: CampaignKind, nextLanguage: string) {
    const message = defaultMessage(nextLanguage, nextKind);
    if (!subjectTouched) setSubject(message.subject);
    if (!bodyTouched) setBody(message.body);
    if (!followUpsTouched) {
      setFollowUps(defaultFollowUpsFor(nextLanguage, nextKind));
    }
  }

  function selectKind(next: CampaignKind) {
    setKind(next);
    if (next === "at_risk") setReasonFilter("");
    applyDefaults(next, language);
  }

  function selectLanguage(next: string) {
    setLanguage(next);
    applyDefaults(effectiveKind, next);
  }

  function updateFollowUp(index: number, patch: Partial<FollowUp>) {
    setFollowUpsTouched(true);
    setFollowUps((steps) =>
      steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  }

  function removeFollowUp(index: number) {
    setFollowUpsTouched(true);
    setFollowUps((steps) => steps.filter((_, i) => i !== index));
  }

  function addFollowUp() {
    setFollowUpsTouched(true);
    setFollowUps((steps) => {
      const suggested = defaultFollowUpsFor(language, kind)[steps.length];
      return [
        ...steps,
        suggested ?? {
          afterDays: 7,
          subject: "Following up",
          body: `Hi {{first_name}},\n\nJust following up on my last message.\n\n{{gym}}`,
        },
      ];
    });
  }

  // WhatsApp is win-back only for V1.
  const effectiveKind: CampaignKind = isWhatsApp ? "win_back" : kind;
  const sample = effectiveKind === "at_risk" ? atRiskSample : winBackSample;
  const sampleBookingUrl =
    effectiveKind === "at_risk" ? atRiskSampleBookingUrl : winBackSampleBookingUrl;

  const context = useMemo(
    () => ({
      firstName: sample?.first_name ?? null,
      gymName,
      monthsAway: monthsSince(sample?.last_visit_at ?? null),
      bookingUrl: sampleBookingUrl,
      reason: sample?.cancellation_reason
        ? (reasons.find((o) => o.value === sample.cancellation_reason)
            ?.label ?? null)
        : null,
      offer: offerText,
      // No offer, no code. Matches contextFor() in src/lib/template.ts, so the
      // preview cannot promise a code the real send would not include.
      offerCode: offerText ? (sample?.offer_code ?? null) : null,
    }),
    [sample, gymName, sampleBookingUrl, offerText, reasons],
  );

  const audienceCount = isWhatsApp
    ? whatsAppAudienceCount
    : kind === "at_risk"
      ? atRiskAudienceCount
      : winBackAudienceCount;
  const days = isWhatsApp
    ? 1
    : Math.ceil(audienceCount / Math.max(1, dailyCap));

  const whatsAppBlocked = isWhatsApp && (!whatsAppEnabled || !whatsAppTemplateSet);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="kind" value={effectiveKind} />
      {!isWhatsApp && kind === "win_back" && reasonFilter ? (
        <input type="hidden" name="reasonFilter" value={reasonFilter} />
      ) : null}

      <Card>
        <CardTitle>How it goes out</CardTitle>
        <p className="mt-1 mb-5 text-[0.875rem] text-stone">
          Email is a one-off note. WhatsApp opens with your approved template
          and then casdey&apos;s assistant handles the reply, up to the hand-off
          when someone says they want to book.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setChannel("email")}
            disabled={pending}
            aria-pressed={channel === "email"}
            className={`rounded-[14px] border p-4 text-left transition-colors ${
              channel === "email"
                ? "border-teal bg-shallow"
                : "border-ash bg-white hover:border-stone"
            }`}
          >
            <p className="font-semibold text-ink">Email</p>
            <p className="mt-1 text-[0.8125rem] text-stone">
              Plain-text note with a booking link and an unsubscribe line.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setChannel("whatsapp")}
            disabled={pending}
            aria-pressed={channel === "whatsapp"}
            className={`rounded-[14px] border p-4 text-left transition-colors ${
              channel === "whatsapp"
                ? "border-teal bg-shallow"
                : "border-ash bg-white hover:border-stone"
            }`}
          >
            <p className="font-semibold text-ink">WhatsApp</p>
            <p className="mt-1 text-[0.8125rem] text-stone">
              Approved template opener, then a real conversation.
            </p>
          </button>
        </div>

        {whatsAppBlocked ? (
          <p className="notice notice-error mt-4">
            {!whatsAppEnabled
              ? "Turn WhatsApp on in Settings → WhatsApp first."
              : "Add your approved template Content SID in Settings → WhatsApp first."}
          </p>
        ) : null}
      </Card>

      {!isWhatsApp ? (
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
                {reasons.map((option) => {
                  const count = reasonCounts[option.value] ?? 0;
                  return (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={count === 0}
                    >
                      {option.label} ({count})
                    </option>
                  );
                })}
              </select>
              <p className="field-hint">
                {anyReasonRecorded
                  ? "Optional. Narrows to members recorded with that reason, so you can write to it directly."
                  : "Nobody on your list has a reason recorded yet, so there is nothing to narrow to. Reasons are set on a member's page, and casdey records one itself when a member says why in a reply."}
              </p>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card>
          <CardTitle>Who this reaches</CardTitle>
          <p className="mt-1 text-[0.875rem] text-stone">
            Every lapsed or cancelled member who has a phone number on file and
            has not opted out of WhatsApp. WhatsApp campaigns are win-back only.
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Campaign name</CardTitle>
        <div className="mt-3 max-w-[24rem]">
          <label htmlFor={`${id}-name`} className="field-label">
            Name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={120}
            disabled={pending}
            className="field"
            defaultValue={
              isWhatsApp
                ? "Lapsed members (WhatsApp)"
                : kind === "at_risk"
                  ? "Check in early"
                  : "Lapsed members"
            }
            key={`${channel}-${kind}`}
          />
          <p className="field-hint">Only you see this.</p>
        </div>
      </Card>

      {!isWhatsApp ? (
        <>
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
                onChange={(event) => selectLanguage(event.target.value)}
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
            <CardTitle>The message casdey will send</CardTitle>
            <p className="mt-1 mb-5 text-[0.875rem] text-stone">
              This is written for you and ready to go. Change it if you want to,
              or leave it alone. It is plain text because that is what a note
              from a gym looks like, and it is what stays out of the promotions
              tab.
            </p>

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
              <MessageEditor
                id={`${id}-body`}
                name="body"
                required
                disabled={pending}
                value={body}
                onChange={(next) => {
                  setBodyTouched(true);
                  setBody(next);
                }}
              />
            </div>
          </Card>

          <Card>
            <CardTitle>One message, or one each</CardTitle>
            <p className="mt-1 mb-4 text-[0.875rem] leading-relaxed text-stone">
              Leave this on and casdey writes every member their own message,
              from the draft above and the facts it holds about them: their
              name, how long they have been away, why they left where you
              recorded it, and your offer word for word. Turn it off and every
              member gets the draft above exactly as it stands.
            </p>

            <label className="flex items-start gap-2.5 text-[0.9375rem] text-ink">
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
                  You will see real examples, written against members from your
                  own list, before you approve anything.
                </span>
              </span>
            </label>
          </Card>

          <Card>
            <CardTitle>If nobody answers</CardTitle>
            <p className="mt-1 mb-5 text-[0.875rem] text-stone">
              One message and then silence is not how a person would do this.
              Each of these goes out only if the member has not booked by then,
              and the sequence stops the moment they do.
            </p>

            {/* Carried as JSON in one hidden field rather than as
                followUps[0][body]-style names: the server parses and
                revalidates it anyway, and flat form fields for a variable
                number of steps is a lot of machinery for two of them. */}
            <input
              type="hidden"
              name="followUps"
              value={JSON.stringify(followUps)}
            />

            {followUps.length === 0 ? (
              <p className="text-[0.9375rem] text-graphite">
                No follow-ups. This campaign sends once.
              </p>
            ) : null}

            {followUps.map((step, index) => (
              <div
                key={index}
                className={
                  "pb-5 " + (index ? "mt-5 border-t border-ash pt-5" : "")
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="field-label mb-0">
                    Follow-up {index + 1}, after
                  </span>
                  <input
                    type="number"
                    min={MIN_FOLLOW_UP_DAYS}
                    max={MAX_FOLLOW_UP_DAYS}
                    step={1}
                    disabled={pending}
                    className="field literal w-20"
                    value={step.afterDays}
                    onChange={(event) =>
                      updateFollowUp(index, {
                        afterDays: Number(event.target.value),
                      })
                    }
                  />
                  <span className="text-[0.9375rem] text-graphite">
                    days with no booking
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeFollowUp(index)}
                    className="ml-auto text-[0.875rem] text-stone underline decoration-ash underline-offset-4 transition-colors duration-200 hover:text-ink"
                  >
                    Remove
                  </button>
                </div>

                <input
                  aria-label={`Follow-up ${index + 1} subject`}
                  maxLength={200}
                  disabled={pending}
                  className="field mb-3"
                  value={step.subject}
                  onChange={(event) =>
                    updateFollowUp(index, { subject: event.target.value })
                  }
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
                onClick={addFollowUp}
                className="text-[0.9375rem] text-teal underline decoration-ash underline-offset-4 transition-colors duration-200 hover:decoration-teal"
              >
                Add a follow-up
              </button>
            ) : (
              <p className="text-[0.8125rem] text-stone">
                Two is the most casdey will send. Past that a win-back stops
                reading as attentive and starts reading as pestering, and it is
                your gym&apos;s name on it.
              </p>
            )}
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
              The unsubscribe line is added to every message and cannot be
              removed.
            </p>
          </Card>
        </>
      ) : (
        <Card>
          <CardTitle>The opener</CardTitle>
          <p className="mt-1 text-[0.875rem] text-stone">
            The first message is your Meta-approved template, sent with your gym
            name filled in. There is no wording to edit here: Meta approves the
            exact text outside casdey. Once a member replies, casdey&apos;s
            assistant takes the conversation, and it is handed to you the moment
            they say they want to book. You can send it to your own number first
            from the campaign screen.
          </p>
        </Card>
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
          {audienceCount === 1 ? "member" : "members"}
          {isWhatsApp ? (
            <> in one send.</>
          ) : (
            <>
              , spread over{" "}
              <span className="literal font-medium text-ink">{days}</span>{" "}
              {days === 1 ? "day" : "days"} at {dailyCap} a day.
            </>
          )}{" "}
          <strong className="font-semibold text-ink">
            Nothing sends until you approve it on the next screen.
          </strong>
        </p>
        <Button
          type="submit"
          disabled={pending || whatsAppBlocked}
          className="mt-4"
        >
          {pending ? "Saving" : "Save as draft"}
        </Button>
      </div>
    </form>
  );
}
