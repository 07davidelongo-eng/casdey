import { describe, expect, it } from "vitest";

import { DEFAULT_BODY, renderTemplate, type TemplateContext } from "./template";

function context(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    firstName: "Aoife",
    gymName: "Iron Works Gym",
    monthsAway: 14,
    bookingUrl: null,
    reason: null,
    offer: null,
    ...overrides,
  };
}

describe("the offer in a message", () => {
  it("appears where the gym put it", () => {
    const out = renderTemplate(DEFAULT_BODY, context({ offer: "Half price for two months, until Saturday 19 September." }));
    expect(out).toContain("Half price for two months, until Saturday 19 September.");
  });

  it("leaves no hole when the gym has not built one", () => {
    // Most gyms will send their first campaign before they build an offer, so
    // this is the common path, not the edge case. An empty token used to leave
    // a gap where a paragraph was meant to be, which a member reads as a broken
    // mail-merge rather than as nothing.
    const out = renderTemplate(DEFAULT_BODY, context({ offer: null }));
    expect(out).not.toContain("{{offer}}");
    expect(out).not.toMatch(/\n\n\n/);
  });

  it("never leaves an unresolved token behind, whatever is missing", () => {
    const out = renderTemplate(DEFAULT_BODY, context({
      firstName: null,
      monthsAway: null,
      bookingUrl: null,
      reason: null,
      offer: null,
    }));
    expect(out).not.toMatch(/\{\{.*\}\}/);
    // "Hi ," is worse than a slightly generic greeting.
    expect(out).toContain("Hi there,");
  });
});
