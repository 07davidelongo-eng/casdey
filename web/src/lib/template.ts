import { monthsSince } from "./dormancy";
import type { Patient, Practice } from "./types";

/**
 * The message template and how it is filled in.
 *
 * Kept out of messaging.ts, which is server-only, because the campaign editor
 * previews the message as the practice types it and needs exactly this code in
 * the browser. Having one renderer means the preview cannot drift from what is
 * actually sent, which is the whole point of showing a preview.
 */

export const DEFAULT_SUBJECT = "It has been a while since your last visit";

/**
 * The starting message. A practice can rewrite every word.
 *
 * Written to casdey's copy rules: no em dashes, nothing asserted about the
 * patient, no manufactured urgency, one thing to do. It reads as though the
 * practice wrote it, because as far as the patient is concerned they did.
 */
export const DEFAULT_BODY = `Hi {{first_name}},

It has been a while since we last saw you at {{practice}}, and we wanted to check you are getting on well.

If you would like to come in for a check-up, reply to this email and we will find you a time that works.

If now is not the right time, that is completely fine.

{{practice}}`;

export type TemplateContext = {
  firstName: string | null;
  practiceName: string;
  monthsAway: number | null;
  /** The patient's booking link, or null when booking is off / not applicable.
   *  Powers {{booking_link}} and the auto-offered link in composeBody. */
  bookingUrl: string | null;
};

type Placeholder = "first_name" | "practice" | "months_away" | "booking_link";

export const PLACEHOLDER_HELP: { token: string; means: string }[] = [
  {
    token: "{{first_name}}",
    means: "their first name, or 'there' when we do not have one",
  },
  { token: "{{practice}}", means: "your practice name" },
  { token: "{{months_away}}", means: "months since their last visit" },
  {
    token: "{{booking_link}}",
    means: "a link where they pick a time (only when booking is on)",
  },
];

export function renderTemplate(
  template: string,
  context: TemplateContext,
): string {
  return template.replace(
    /\{\{\s*(first_name|practice|months_away|booking_link)\s*\}\}/g,
    (_match, token: Placeholder) => {
      if (token === "first_name") {
        // "Hi ," is worse than a slightly generic greeting.
        return context.firstName?.trim() || "there";
      }
      if (token === "practice") return context.practiceName;
      if (token === "booking_link") return context.bookingUrl ?? "";
      return context.monthsAway === null
        ? "some time"
        : String(context.monthsAway);
    },
  );
}

export function contextFor(
  patient: Pick<Patient, "first_name" | "last_visit_at">,
  practice: Pick<Practice, "name">,
  now: Date = new Date(),
  bookingUrl: string | null = null,
): TemplateContext {
  return {
    firstName: patient.first_name,
    practiceName: practice.name,
    monthsAway: monthsSince(patient.last_visit_at, now),
    bookingUrl,
  };
}

/**
 * The footer every patient email carries, without exception.
 *
 * A one-click way out is not a nicety: under GDPR and PECR it is the difference
 * between a legitimate message and an unlawful one. It is appended here rather
 * than left in the editable template so a practice cannot remove it by
 * rewriting their copy.
 *
 * When the provider cannot set a reply-to, the practice's own address goes into
 * the text instead, so "reply to this email" is never a dead end.
 */
export function composeBody(options: {
  body: string;
  context: TemplateContext;
  unsubscribeUrl: string;
  replyTo: string | null;
  providerCanSetReplyTo: boolean;
}): string {
  const rendered = renderTemplate(options.body, options.context).trim();
  const parts = [rendered, ""];

  // When booking is on, make sure the patient actually gets the link, even if
  // the practice did not add {{booking_link}} to their copy. Skipped if the
  // rendered body already contains it, so a practice that placed the link
  // themselves does not get it twice.
  const bookingUrl = options.context.bookingUrl;
  if (bookingUrl && !rendered.includes(bookingUrl)) {
    parts.push("To book a time that suits you, follow this link:", bookingUrl, "");
  }

  if (!options.providerCanSetReplyTo && options.replyTo) {
    parts.push(`You can also write to us directly at ${options.replyTo}.`, "");
  }

  parts.push(
    "If you would rather not hear from us again, tell us here and we will stop:",
    options.unsubscribeUrl,
  );

  return parts.join("\n");
}
