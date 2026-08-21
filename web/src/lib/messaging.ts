import "server-only";

import { sendMail } from "./zoho-mail";

/**
 * Actually putting a message on the wire.
 *
 * Two providers, one interface. Zoho is what casdey already has and it works
 * today, but it can only send as info@casdey.com and cannot set a reply-to
 * (Zoho rejects any reply-to address it has not verified, which an arbitrary
 * gym inbox never will be). Resend can do both, so when a key is present
 * it is used and the member sees their own gym rather than casdey.
 *
 * The template itself lives in ./template.ts, which is not server-only: the
 * campaign editor previews the message in the browser with the same renderer
 * that sends it.
 */

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  fromName: string;
  replyTo: string | null;
  /** An optional .ics to attach, e.g. a booking confirmation. Resend attaches
   *  it; Zoho (the legacy fallback) sends without one rather than fail the
   *  whole send over a calendar file, since the confirmation text already
   *  states the booking details. */
  attachment?: { filename: string; content: string; contentType: string };
};

export type SendResult = { providerMessageId: string | null };

export type EmailProvider = {
  id: "resend" | "zoho";
  /** Whether a member's reply reaches the gym directly. */
  canSetReplyTo: boolean;
  send(email: OutgoingEmail): Promise<SendResult>;
};

/** A display name must not carry the characters that would let it forge a header. */
function sanitizeDisplayName(name: string): string {
  return name.replace(/["<>\r\n]/g, "").trim().slice(0, 78) || "casdey";
}

const resendProvider: EmailProvider = {
  id: "resend",
  canSetReplyTo: true,
  async send(email) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");

    const from = process.env.CASDEY_SENDING_ADDRESS ?? "no-reply@casdey.com";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // The gym's name on casdey's verified domain: the member sees who
        // it is from, and the domain reputation is one we can actually manage.
        from: `${sanitizeDisplayName(email.fromName)} <${from}>`,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        reply_to: email.replyTo ?? undefined,
        attachments: email.attachment
          ? [
              {
                filename: email.attachment.filename,
                content: email.attachment.content,
              },
            ]
          : undefined,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Resend failed: ${response.status} ${detail.slice(0, 200)}`,
      );
    }

    const body = (await response.json()) as { id?: string };
    return { providerMessageId: body.id ?? null };
  },
};

const zohoProvider: EmailProvider = {
  id: "zoho",
  canSetReplyTo: false,
  async send(email) {
    await sendMail({ to: email.to, subject: email.subject, text: email.text });
    return { providerMessageId: null };
  },
};

export function emailProvider(): EmailProvider {
  return process.env.RESEND_API_KEY ? resendProvider : zohoProvider;
}

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  // In production a missing value must never silently become localhost: this
  // string is baked into every member unsubscribe/booking link. A localhost
  // fallback there means dead opt-out links in already-sent mail, with no error
  // surfaced. Fail loudly instead; the localhost default is for local dev only.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. Refusing to fall back to http://localhost:3000 in production.",
    );
  }
  return "http://localhost:3000";
}

export function unsubscribeUrl(token: string): string {
  return `${siteUrl()}/u/${token}`;
}

export function bookingUrl(token: string): string {
  return `${siteUrl()}/book/${token}`;
}
