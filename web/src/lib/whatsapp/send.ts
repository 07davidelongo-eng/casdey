import "server-only";

import { sendWhatsAppMessage } from "./twilio";

/**
 * The WhatsApp equivalent of ../messaging.ts's `EmailProvider`.
 *
 * One shared casdey WhatsApp sender for every gym (mirrors the shared
 * mail.casdey.com email domain), not a number per gym: provisioning a
 * Meta-approved WhatsApp sender per gym is not realistic to do by hand
 * right now. `whatsappProvider()` falls back to a "disabled" stub when
 * Twilio is not configured, same pattern as `emailProvider()` falling back
 * to Zoho.
 *
 * Two send modes, not one, because WhatsApp itself treats them differently:
 * a template send is required for any business-initiated message outside the
 * 24h customer-service window (a campaign's first contact, a self-test), and
 * a freeform send is only legal once the member has replied and the window
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

function twilioProviderFor(from: string): WhatsAppProvider {
  return {
    id: "twilio",
    async sendTemplate({ to, templateSid, params }) {
      return sendWhatsAppMessage({
        to,
        from,
        templateSid,
        templateParams: params,
      });
    },
    async sendFreeform({ to, body }) {
      return sendWhatsAppMessage({ to, from, body });
    },
  };
}

const NO_TWILIO =
  "WhatsApp sending is not configured (TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing).";

const NO_SENDER =
  "This gym has not connected its own WhatsApp sender yet, so nothing can be sent in its name.";

function disabledProvider(reason: string): WhatsAppProvider {
  return {
    id: "disabled",
    async sendTemplate() {
      throw new Error(reason);
    },
    async sendFreeform() {
      throw new Error(reason);
    },
  };
}

/**
 * The provider for ONE gym, built around that gym's own sender number.
 *
 * There is deliberately no way to get a provider without naming a sender. The
 * previous version read a single `TWILIO_WHATSAPP_FROM` for every gym, which
 * meant every gym's members received a message from a WhatsApp business called
 * "casdey" rather than from the gym they had actually been a member of. That
 * is not fixable in message copy: on WhatsApp the display name is a property
 * of the number, not of the message.
 *
 * `from` comes from `gyms.whatsapp_from`. Null degrades to a provider that
 * errors clearly, exactly as an unconfigured Twilio does.
 */
export function whatsappProvider(from: string | null): WhatsAppProvider {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return disabledProvider(NO_TWILIO);
  }
  if (!from) return disabledProvider(NO_SENDER);
  return twilioProviderFor(from);
}
