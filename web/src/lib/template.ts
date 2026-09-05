import { monthsSince } from "./lapse";
import { REASON_LABELS } from "./cancellation";
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

{{offer}}

If you would like to come back in, reply to this email and we will find you a time that works.

If now is not the right time, that is completely fine.

{{gym}}`;

/**
 * A gentler starting message for at-risk campaigns: these members have not
 * lapsed, so this checks in rather than declaring a problem. Written to the
 * same rule the win-back default follows, and to the same lesson a
 * competitor's founder pointed out about casdey's own cold outreach this
 * session: ask, do not presume.
 */
export const DEFAULT_AT_RISK_SUBJECT = "Everything OK? Haven't seen you in a bit";

export const DEFAULT_AT_RISK_BODY = `Hi {{first_name}},

We noticed it has been a little while since your last visit to {{gym}}, so wanted to check in, that's all.

No pressure either way, just reply if there is anything getting in the way of coming back in, we would like to know.

{{gym}}`;

export type TemplateContext = {
  firstName: string | null;
  gymName: string;
  monthsAway: number | null;
  /** The member's booking link, or null when booking is off / not applicable.
   *  Powers {{booking_link}} and the auto-offered link in composeBody. */
  bookingUrl: string | null;
  /** A natural-language phrase for why they left (see REASON_LABELS), or
   *  null when no reason is on file. Powers {{reason}}. */
  reason: string | null;
  /**
   * The gym's chosen win-back offer, already rendered with a real date, or null
   * when it has not built one. Powers {{offer}}.
   *
   * Read from the gym row rather than composed here: the wording a member was
   * promised is fixed when the campaign is created, so editing the offer later
   * never rewrites what someone was already sent.
   */
  offer: string | null;
};

type Placeholder =
  | "first_name"
  | "gym"
  | "months_away"
  | "booking_link"
  | "reason"
  | "offer";

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
  {
    token: "{{reason}}",
    means:
      "why they left, in a short natural phrase (only when you recorded one)",
  },
  {
    token: "{{offer}}",
    means: "the win-back offer you built, with its deadline as a real date",
  },
];

export function renderTemplate(
  template: string,
  context: TemplateContext,
): string {
  const rendered = template.replace(
    /\{\{\s*(first_name|gym|months_away|booking_link|reason|offer)\s*\}\}/g,
    (_match, token: Placeholder) => {
      if (token === "first_name") {
        // "Hi ," is worse than a slightly generic greeting.
        return context.firstName?.trim() || "there";
      }
      if (token === "gym") return context.gymName;
      if (token === "booking_link") return context.bookingUrl ?? "";
      if (token === "reason") return context.reason ?? "it being a while";
      // Empty rather than a placeholder apology: a gym that has not built an
      // offer should send a clean message, not one with a hole where an offer
      // was meant to be.
      if (token === "offer") return context.offer ?? "";
      return context.monthsAway === null
        ? "some time"
        : String(context.monthsAway);
    },
  );

  // A token that renders empty (no offer built, no booking link) would leave a
  // gap where a paragraph was meant to be, and a member reads that as a broken
  // mail-merge rather than as nothing. Close the gap instead.
  return rendered.replace(/\n{3,}/g, "\n\n").trim();
}

export function contextFor(
  member: Pick<
    Member,
    "first_name" | "last_visit_at" | "cancellation_reason"
  >,
  gym: Pick<Gym, "name" | "offer_text">,
  now: Date = new Date(),
  bookingUrl: string | null = null,
): TemplateContext {
  return {
    firstName: member.first_name,
    gymName: gym.name,
    monthsAway: monthsSince(member.last_visit_at, now),
    bookingUrl,
    offer: gym.offer_text ?? null,
    reason: member.cancellation_reason
      ? REASON_LABELS[member.cancellation_reason]
      : null,
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
