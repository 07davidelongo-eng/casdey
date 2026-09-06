import { describe, expect, it } from "vitest";

import {
  annualisedMinor,
  isBillingPeriod,
  isExclusive,
  isRecurring,
  periodSuffix,
  slotShape,
} from "./services";

const DEFAULTS = { slotMinutes: 30, bufferMinutes: 10 };

describe("billing periods", () => {
  it("treats a pack or a single session as one off", () => {
    expect(isRecurring("one_off")).toBe(false);
  });

  it("treats every other period as recurring", () => {
    expect(isRecurring("monthly")).toBe(true);
    expect(isRecurring("annual")).toBe(true);
  });

  it("rejects anything that is not a period casdey knows", () => {
    expect(isBillingPeriod("fortnightly")).toBe(true);
    expect(isBillingPeriod("every other tuesday")).toBe(false);
    expect(isBillingPeriod(null)).toBe(false);
  });

  it("says a one-off price without a period suffix", () => {
    expect(periodSuffix("one_off")).toBe("");
    expect(periodSuffix("monthly")).toBe("a month");
  });
});

describe("annualisedMinor", () => {
  it("leaves a one-off alone", () => {
    expect(
      annualisedMinor({ price_minor: 12000, billing_period: "one_off" }),
    ).toBe(12000);
  });

  it("projects a monthly membership over a year", () => {
    expect(
      annualisedMinor({ price_minor: 8900, billing_period: "monthly" }),
    ).toBe(8900 * 12);
  });

  it("does not multiply an annual membership", () => {
    expect(
      annualisedMinor({ price_minor: 89000, billing_period: "annual" }),
    ).toBe(89000);
  });
});

describe("slotShape", () => {
  it("uses the gym's defaults when the service says nothing", () => {
    expect(slotShape(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(
      slotShape({ duration_minutes: null, buffer_minutes: null }, DEFAULTS),
    ).toEqual(DEFAULTS);
  });

  it("lets a service override one without the other", () => {
    // A 60-minute class in a gym that defaults to 30 still wants the gym's
    // usual gap after it.
    expect(
      slotShape({ duration_minutes: 60, buffer_minutes: null }, DEFAULTS),
    ).toEqual({ slotMinutes: 60, bufferMinutes: 10 });
  });

  it("keeps a zero buffer rather than reading it as unset", () => {
    expect(
      slotShape({ duration_minutes: 45, buffer_minutes: 0 }, DEFAULTS),
    ).toEqual({ slotMinutes: 45, bufferMinutes: 0 });
  });
});

describe("isExclusive", () => {
  it("treats a one-place service as taking the whole diary", () => {
    expect(isExclusive({ capacity: 1 })).toBe(true);
  });

  it("treats a class as shared", () => {
    expect(isExclusive({ capacity: 20 })).toBe(false);
  });

  it("assumes a booking with no service occupies somebody", () => {
    // casdey has no idea what it is, and the safe assumption is that it
    // blocks the gym rather than that twenty of them can happen at once.
    expect(isExclusive(null)).toBe(true);
  });
});
