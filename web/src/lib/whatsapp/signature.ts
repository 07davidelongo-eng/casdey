import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio's documented request-validation algorithm: the full webhook URL,
 * followed by every POST parameter's key and value concatenated in sorted
 * key order (no separators), HMAC-SHA1'd with the auth token and base64
 * encoded. See https://www.twilio.com/docs/usage/security#validating-requests.
 *
 * This is the only thing standing between the inbound webhook
 * (../../app/api/whatsapp/webhook/route.ts) and anyone on the internet who
 * can guess the URL, so it fails closed: no auth token, no pass.
 *
 * Kept free of "server-only" (unlike ./twilio.ts) so it can be unit tested
 * directly, same reasoning as ../template.ts being split from ../messaging.ts.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string | undefined = process.env.TWILIO_AUTH_TOKEN,
): boolean {
  if (!authToken || !signature) return false;

  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }

  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
