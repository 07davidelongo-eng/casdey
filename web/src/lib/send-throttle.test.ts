import { describe, expect, it } from "vitest";

import { isProviderThrottled } from "./send-throttle";

describe("isProviderThrottled", () => {
  it("recognises the shapes Resend actually throws", () => {
    // The provider layer formats these itself, so these are the real strings
    // that reach the sender's catch block.
    expect(
      isProviderThrottled(
        'Resend failed: 429 {"name":"rate_limit_exceeded","message":"Too many requests."}',
      ),
    ).toBe(true);
    expect(
      isProviderThrottled(
        'Resend failed: 429 {"name":"daily_quota_exceeded","message":"You have reached your daily sending quota."}',
      ),
    ).toBe(true);
  });

  it("does not mistake a bad address for a busy provider", () => {
    // These SHOULD burn an attempt and eventually retire the message.
    expect(
      isProviderThrottled(
        'Resend failed: 422 {"name":"validation_error","message":"Invalid `to` field."}',
      ),
    ).toBe(false);
    expect(isProviderThrottled("Resend failed: 400 Bad Request")).toBe(false);
    expect(isProviderThrottled("getaddrinfo ENOTFOUND api.resend.com")).toBe(
      false,
    );
  });

  it("is not upset by casing", () => {
    expect(isProviderThrottled("Too Many Requests")).toBe(true);
    expect(isProviderThrottled("QUOTA exceeded")).toBe(true);
  });
});
