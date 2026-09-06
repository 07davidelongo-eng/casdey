import { describe, expect, it } from "vitest";

import {
  currencySymbol,
  formatMoney,
  gymCurrency,
} from "./money";

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
