import "server-only";

import { sendWhatsAppMessage } from "./twilio";

/**
 * The WhatsApp equivalent of ../messaging.ts's `EmailProvider`.
 *
 * One shared casdey WhatsApp sender for every practice (mirrors the shared
 * mail.casdey.com email domain), not a number per practice: provisioning a
 * Meta-approved WhatsApp sender per practice is not realistic to do by hand
 * right now. `whatsappProvider()` falls back to a "disabled" stub when
 * Twilio is not configured, same pattern as `emailProvider()` falling back
 * to Zoho.
 *
 * Two send modes, not one, because WhatsApp itself treats them differently:
 * a template send is required for any business-initiated message outside the
 * 24h customer-service window (a campaign's first contact, a self-test), and
 * a freeform send is only legal once the patient has replied and the window
 * is open (the AI reply loop in ./ai-agent.ts).
 */

export type WhatsAppSendResult = { providerMessageId: string };

export type WhatsAppProvider = {
  id: "twilio" | "disabled";
  sendTemplate(opts: {
    to: string;
    templateSid: string;
    params?: Record<string, string>;
  }): Promise<WhatsAppSendResult>;
  sendFreeform(opts: { to: string; body: string }): Promise<WhatsAppSendResult>;
};

const twilioProvider: WhatsAppProvider = {
  id: "twilio",
  async sendTemplate({ to, templateSid, params }) {
    return sendWhatsAppMessage({ to, templateSid, templateParams: params });
  },
  async sendFreeform({ to, body }) {
    return sendWhatsAppMessage({ to, body });
  },
};

const NOT_CONFIGURED =
  "WhatsApp sending is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_WHATSAPP_FROM is missing).";

const disabledProvider: WhatsAppProvider = {
  id: "disabled",
  async sendTemplate() {
    throw new Error(NOT_CONFIGURED);
  },
  async sendFreeform() {
    throw new Error(NOT_CONFIGURED);
  },
};

export function whatsappProvider(): WhatsAppProvider {
  return process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
    ? twilioProvider
    : disabledProvider;
}
