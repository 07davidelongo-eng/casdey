import { describe, expect, it } from "vitest";

import { isCancellationReason, REASON_LABELS, REASON_OPTIONS } from "./cancellation";

describe("isCancellationReason", () => {
  it("accepts every real reason value", () => {
    for (const option of REASON_OPTIONS) {
      expect(isCancellationReason(option.value)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isCancellationReason("made_up")).toBe(false);
    expect(isCancellationReason("")).toBe(false);
    expect(isCancellationReason(null)).toBe(false);
    expect(isCancellationReason(undefined)).toBe(false);
    expect(isCancellationReason(42)).toBe(false);
  });
});

describe("REASON_LABELS", () => {
  it("has a natural-language label for every reason", () => {
    for (const option of REASON_OPTIONS) {
      expect(REASON_LABELS[option.value]).toBeTruthy();
    }
  });
});
