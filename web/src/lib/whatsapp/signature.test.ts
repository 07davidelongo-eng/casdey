import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyTwilioSignature } from "./signature";

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
