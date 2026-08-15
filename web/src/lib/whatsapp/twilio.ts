import "server-only";

/**
 * The one place that actually talks to Twilio.
 *
 * Raw fetch, no `twilio` npm dependency, same choice already made for Resend
 * in ../messaging.ts: both APIs are small enough that a hand-rolled call is
 * less to carry than a whole SDK.
 *
 * WhatsApp has two send modes that Twilio's API treats differently:
 *
 *   - A template send (`ContentSid` + `ContentVariables`), required for any
 *     business-initiated message outside a 24h customer-service window: a
 *     campaign's first contact, or a self-test.
 *   - A freeform send (`Body`), only legal once the patient has replied and
 *     the window is open: the AI reply loop.
 *
 * `sendWhatsAppMessage` takes either shape; the caller in ./send.ts decides
 * which one a given send needs.
 *
 * Signature verification lives in ./signature.ts instead of here, kept free
 * of "server-only" so it can be unit tested directly (the same reason
 * ../template.ts is split out from ../messaging.ts).
 */

export type WhatsAppSendResult = { providerMessageId: string };

export async function sendWhatsAppMessage(opts: {
  to: string;
  body?: string;
  templateSid?: string;
  templateParams?: Record<string, string>;
}): Promise<WhatsAppSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error(
      "Twilio WhatsApp is not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM",
    );
  }

  const params = new URLSearchParams();
  params.set("From", `whatsapp:${from}`);
  params.set("To", `whatsapp:${opts.to}`);

  if (opts.templateSid) {
    params.set("ContentSid", opts.templateSid);
    if (opts.templateParams) {
      params.set("ContentVariables", JSON.stringify(opts.templateParams));
    }
  } else if (opts.body) {
    params.set("Body", opts.body);
  } else {
    throw new Error(
      "sendWhatsAppMessage needs either a body (freeform) or a templateSid (business-initiated)",
    );
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Twilio failed: ${response.status} ${detail.slice(0, 200)}`);
  }

  const json = (await response.json()) as { sid?: string };
  if (!json.sid) throw new Error("Twilio accepted the send but returned no message sid");
  return { providerMessageId: json.sid };
}
