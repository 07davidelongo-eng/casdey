import { describe, expect, it } from "vitest";

import {
  currencySymbol,
  estimatedRecoveredMinor,
  formatMoney,
  gymCurrency,
} from "./money";
import type { Gym } from "./types";

describe("formatMoney", () => {
  it("shows a round amount with no decimal part", () => {
    expect(formatMoney(125000, "gbp")).toBe("£1,250");
    expect(formatMoney(29000, "eur")).toBe("€290");
  });

  it("keeps both digits when the amount is not round", () => {
    expect(formatMoney(126250, "gbp")).toBe("£1,262.50");
    expect(formatMoney(2999, "eur")).toBe("€29.99");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "gbp")).toBe("£0");
  });
});

describe("currencySymbol", () => {
  it("maps each currency to its symbol", () => {
    expect(currencySymbol("gbp")).toBe("£");
    expect(currencySymbol("eur")).toBe("€");
  });
});

describe("gymCurrency", () => {
  it("uses the billing currency once it is set", () => {
    expect(gymCurrency({ plan_currency: "eur", country: "GB" })).toBe("eur");
  });

  it("falls back to the country before checkout", () => {
    expect(gymCurrency({ plan_currency: null, country: "GB" })).toBe("gbp");
    expect(gymCurrency({ plan_currency: null, country: "DE" })).toBe("eur");
  });
});

describe("estimatedRecoveredMinor", () => {
  it("multiplies returns by the booking value", () => {
    expect(estimatedRecoveredMinor(8, 12000)).toBe(96000);
  });

  it("is null when no value is set, so callers prompt rather than show £0", () => {
    expect(estimatedRecoveredMinor(8, null)).toBeNull();
    expect(estimatedRecoveredMinor(8, 0)).toBeNull();
  });

  it("is a real figure of zero when nobody has returned yet", () => {
    expect(estimatedRecoveredMinor(0, 12000)).toBe(0);
  });
});

// A compile-time guard that gymCurrency accepts a full Gym, not only
// the picked shape the tests above pass.
const _fullGym = (p: Gym) => gymCurrency(p);
void _fullGym;
