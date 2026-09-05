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

/**
 * The same check, against every URL this webhook can legitimately have been
 * configured as.
 *
 * Twilio signs the URL exactly as it was typed into the console, and casdey
 * answers on both the apex and www (the apex 308s to www in production). So a
 * console entry of https://www.casdey.com/... produces a signature that will
 * never match a check against https://casdey.com/..., and the other way round.
 * The failure is silent and total: every inbound reply is rejected 401, the
 * member's answer is lost, and the gym sees nothing at all. Whoever sets it up
 * will copy the URL from their browser, which is the www one, so the odds of
 * getting this wrong first time are high.
 *
 * Accepting either spelling gives nothing away. The signature is an HMAC under
 * the account's auth token, so anyone without that token can forge a valid
 * signature for no URL at all, and the candidates here are only ever casdey's
 * own hostnames.
 */
export function verifyTwilioSignatureForAnyUrl(
  urls: string[],
  params: Record<string, string>,
  signature: string,
  authToken: string | undefined = process.env.TWILIO_AUTH_TOKEN,
): boolean {
  // No early return: every candidate is checked, so how long this takes does
  // not reveal which URL matched.
  let matched = false;
  for (const url of urls) {
    if (verifyTwilioSignature(url, params, signature, authToken)) matched = true;
  }
  return matched;
}

/**
 * Every hostname spelling of the webhook that casdey serves, canonical first.
 * The request's own host is included because that is what Twilio reached, and
 * a deployment on a different domain should keep working without a code change.
 */
export function webhookUrlCandidates(
  canonicalSiteUrl: string,
  requestUrl: string,
  path = "/api/whatsapp/webhook",
): string[] {
  const urls = new Set<string>();
  const canonical = canonicalSiteUrl.replace(/\/+$/, "");
  urls.add(`${canonical}${path}`);

  try {
    const { protocol, host } = new URL(canonicalSiteUrl);
    const bare = host.replace(/^www\./, "");
    urls.add(`${protocol}//${bare}${path}`);
    urls.add(`${protocol}//www.${bare}${path}`);
  } catch {
    /* A malformed site URL still leaves the canonical string above. */
  }

  try {
    const { origin } = new URL(requestUrl);
    urls.add(`${origin}${path}`);
  } catch {
    /* Ignore an unparseable request URL. */
  }

  return [...urls];
}
