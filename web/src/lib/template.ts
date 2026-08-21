import { monthsSince } from "./lapse";
import type { Member, Gym } from "./types";

/**
 * The message template and how it is filled in.
 *
 * Kept out of messaging.ts, which is server-only, because the campaign editor
 * previews the message as the gym types it and needs exactly this code in
 * the browser. Having one renderer means the preview cannot drift from what is
 * actually sent, which is the whole point of showing a preview.
 */

export const DEFAULT_SUBJECT = "It has been a while since your last visit";

/**
 * The starting message. A gym can rewrite every word.
 *
 * Written to casdey's copy rules: no em dashes, nothing asserted about the
 * member, no manufactured urgency, one thing to do. It reads as though the
 * gym wrote it, because as far as the member is concerned they did.
 */
export const DEFAULT_BODY = `Hi {{first_name}},

It has been a while since we last saw you at {{gym}}, and we wanted to check you are getting on well.

If you would like to come back in, reply to this email and we will find you a time that works.

If now is not the right time, that is completely fine.

{{gym}}`;

export type TemplateContext = {
  firstName: string | null;
  gymName: string;
  monthsAway: number | null;
  /** The member's booking link, or null when booking is off / not applicable.
   *  Powers {{booking_link}} and the auto-offered link in composeBody. */
  bookingUrl: string | null;
};

type Placeholder = "first_name" | "gym" | "months_away" | "booking_link";

export const PLACEHOLDER_HELP: { token: string; means: string }[] = [
  {
    token: "{{first_name}}",
    means: "their first name, or 'there' when we do not have one",
  },
  { token: "{{gym}}", means: "your gym name" },
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
    /\{\{\s*(first_name|gym|months_away|booking_link)\s*\}\}/g,
    (_match, token: Placeholder) => {
      if (token === "first_name") {
        // "Hi ," is worse than a slightly generic greeting.
        return context.firstName?.trim() || "there";
      }
      if (token === "gym") return context.gymName;
      if (token === "booking_link") return context.bookingUrl ?? "";
      return context.monthsAway === null
        ? "some time"
        : String(context.monthsAway);
    },
  );
}

export function contextFor(
  member: Pick<Member, "first_name" | "last_visit_at">,
  gym: Pick<Gym, "name">,
  now: Date = new Date(),
  bookingUrl: string | null = null,
): TemplateContext {
  return {
    firstName: member.first_name,
    gymName: gym.name,
    monthsAway: monthsSince(member.last_visit_at, now),
    bookingUrl,
  };
}

/**
 * The footer every member email carries, without exception.
 *
 * A one-click way out is not a nicety: under GDPR and PECR it is the difference
 * between a legitimate message and an unlawful one. It is appended here rather
 * than left in the editable template so a gym cannot remove it by
 * rewriting their copy.
 *
 * When the provider cannot set a reply-to, the gym's own address goes into
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

  // When booking is on, make sure the member actually gets the link, even if
  // the gym did not add {{booking_link}} to their copy. Skipped if the
  // rendered body already contains it, so a gym that placed the link
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
