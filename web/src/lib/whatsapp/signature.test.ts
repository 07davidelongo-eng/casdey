import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  verifyTwilioSignature,
  verifyTwilioSignatureForAnyUrl,
  webhookUrlCandidates,
} from "./signature";

const AUTH_TOKEN = "test-auth-token";
const URL = "https://casdey.com/api/whatsapp/webhook";

function sign(url: string, params: Record<string, string>, authToken: string): string {
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

describe("verifyTwilioSignature", () => {
  it("accepts a signature computed the same way Twilio computes it", () => {
    const params = { From: "whatsapp:+447700900123", Body: "Hi there" };
    const signature = sign(URL, params, AUTH_TOKEN);
    expect(verifyTwilioSignature(URL, params, signature, AUTH_TOKEN)).toBe(true);
  });

  it("is order-independent: the params object's own key order does not matter", () => {
    const inOrder = { A: "1", B: "2" };
    const reversed = { B: "2", A: "1" };
    const signature = sign(URL, inOrder, AUTH_TOKEN);
    expect(verifyTwilioSignature(URL, reversed, signature, AUTH_TOKEN)).toBe(true);
  });

  it("rejects a tampered parameter", () => {
    const params = { From: "whatsapp:+447700900123", Body: "Hi there" };
    const signature = sign(URL, params, AUTH_TOKEN);
    const tampered = { ...params, Body: "STOP" };
    expect(verifyTwilioSignature(URL, tampered, signature, AUTH_TOKEN)).toBe(false);
  });

  it("rejects a signature computed against a different URL", () => {
    const params = { Body: "Hi there" };
    const signature = sign(URL, params, AUTH_TOKEN);
    expect(
      verifyTwilioSignature("https://evil.example/webhook", params, signature, AUTH_TOKEN),
    ).toBe(false);
  });

  it("rejects a signature computed with a different auth token", () => {
    const params = { Body: "Hi there" };
    const signature = sign(URL, params, "a-different-token");
    expect(verifyTwilioSignature(URL, params, signature, AUTH_TOKEN)).toBe(false);
  });

  it("fails closed when the auth token is missing", () => {
    const params = { Body: "Hi there" };
    const signature = sign(URL, params, AUTH_TOKEN);
    expect(verifyTwilioSignature(URL, params, signature, undefined)).toBe(false);
  });

  it("fails closed when the signature is empty", () => {
    expect(verifyTwilioSignature(URL, { Body: "Hi" }, "", AUTH_TOKEN)).toBe(false);
  });
});

/**
 * Twilio signs the URL exactly as it was typed into its console, and casdey
 * answers on both the apex and www. Getting this wrong rejects every inbound
 * reply with a 401: the member's answer vanishes and the gym never learns a
 * conversation happened.
 */
describe("webhook URL spellings", () => {
  const token = "test-auth-token";
  const params: Record<string, string> = {
    From: "whatsapp:+353851234567",
    To: "whatsapp:+353850000000",
    Body: "yes please",
    MessageSid: "SM123",
  };

  function sign(url: string): string {
    let data = url;
    for (const key of Object.keys(params).sort()) data += key + params[key];
    return createHmac("sha1", token).update(data, "utf8").digest("base64");
  }

  const apex = "https://casdey.com/api/whatsapp/webhook";
  const www = "https://www.casdey.com/api/whatsapp/webhook";

  it("offers both spellings whichever one is canonical", () => {
    const fromApex = webhookUrlCandidates(
      "https://casdey.com",
      "https://www.casdey.com/api/whatsapp/webhook",
    );
    expect(fromApex).toContain(apex);
    expect(fromApex).toContain(www);

    const fromWww = webhookUrlCandidates(
      "https://www.casdey.com",
      "https://www.casdey.com/api/whatsapp/webhook",
    );
    expect(fromWww).toContain(apex);
    expect(fromWww).toContain(www);
  });

  it("accepts a signature made against the apex", () => {
    expect(
      verifyTwilioSignatureForAnyUrl([apex, www], params, sign(apex), token),
    ).toBe(true);
  });

  it("accepts a signature made against www, which is what a browser shows", () => {
    // The old code checked only the canonical apex, so this was a 401 and the
    // reply was lost. Whoever configures Twilio copies the URL they can see.
    expect(
      verifyTwilioSignatureForAnyUrl([apex, www], params, sign(www), token),
    ).toBe(true);
  });

  it("still refuses a signature for somebody else's URL", () => {
    const elsewhere = "https://attacker.example/api/whatsapp/webhook";
    expect(
      verifyTwilioSignatureForAnyUrl(
        [apex, www],
        params,
        sign(elsewhere),
        token,
      ),
    ).toBe(false);
  });

  it("still refuses a tampered body", () => {
    const signature = sign(apex);
    expect(
      verifyTwilioSignatureForAnyUrl(
        [apex, www],
        { ...params, Body: "no thanks" },
        signature,
        token,
      ),
    ).toBe(false);
  });

  it("fails closed with no auth token", () => {
    expect(
      verifyTwilioSignatureForAnyUrl([apex, www], params, sign(apex), undefined),
    ).toBe(false);
  });

  it("keeps the single-URL check working for callers that want one", () => {
    expect(verifyTwilioSignature(apex, params, sign(apex), token)).toBe(true);
    expect(verifyTwilioSignature(www, params, sign(apex), token)).toBe(false);
  });
});
