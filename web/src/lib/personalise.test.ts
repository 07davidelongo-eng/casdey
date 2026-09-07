import { describe, expect, it } from "vitest";

import { acceptable, type PersonaliseInput } from "./personalise";

const BASE: PersonaliseInput = {
  gymName: "Iron Works Gym",
  template: "Hi {{first_name}}, come back in.",
  context: {
    firstName: "Marco",
    gymName: "Iron Works Gym",
    monthsAway: 8,
    bookingUrl: null,
    reason: null,
    offer: null,
    offerCode: null,
  },
  step: 1,
};

const GOOD =
  "Hi Marco, it has been about eight months since we last saw you at Iron Works Gym. No pressure at all, but if you fancy coming back in, just reply and we will sort you a time.";

describe("what a personalised message has to survive", () => {
  it("accepts an ordinary rewrite", () => {
    expect(acceptable(GOOD, BASE)).toBe(true);
  });

  it("rejects nothing at all", () => {
    expect(acceptable("", BASE)).toBe(false);
    expect(acceptable("Hi Marco.", BASE)).toBe(false);
  });

  it("rejects an essay", () => {
    expect(acceptable("word ".repeat(500), BASE)).toBe(false);
  });

  it("rejects a message that reworded an offer the gym put in", () => {
    // The offer is a promise about money. "Two free weeks" paraphrased into
    // "a couple of weeks on us" is a different promise, made in the gym's
    // name, and the gym never agreed to it.
    const withOffer: PersonaliseInput = {
      ...BASE,
      template: "Hi {{first_name}}, come back in.\n\n{{offer}}",
      context: { ...BASE.context, offer: "Your first two weeks back are free." },
    };
    expect(acceptable(GOOD, withOffer)).toBe(false);
    expect(
      acceptable(`${GOOD}\n\nYour first two weeks back are free.`, withOffer),
    ).toBe(true);
  });

  it("rejects a message that added an offer the gym left out", () => {
    // The gym's offer outlives the campaign that introduced it, so a gym with
    // an old discount on file can write a plain check-in months later. Adding
    // the discount back is spending the gym's money for it.
    const offerOnFileButUnused: PersonaliseInput = {
      ...BASE,
      template: "Hi {{first_name}}, come back in.",
      context: { ...BASE.context, offer: "Your first two weeks back are free." },
    };
    expect(
      acceptable(
        `${GOOD}\n\nYour first two weeks back are free.`,
        offerOnFileButUnused,
      ),
    ).toBe(false);
    expect(acceptable(GOOD, offerOnFileButUnused)).toBe(true);
  });

  it("counts an offer the gym typed out by hand, not just {{offer}}", () => {
    // Placeholder or hand-typed, the member reads the same words, so the
    // verbatim rule has to apply the same way to both.
    const handTyped: PersonaliseInput = {
      ...BASE,
      template:
        "Hi {{first_name}}, come back in.\n\nYour first two weeks back are free.",
      context: { ...BASE.context, offer: "Your first two weeks back are free." },
    };
    expect(acceptable(GOOD, handTyped)).toBe(false);
    expect(
      acceptable(`${GOOD}\n\nYour first two weeks back are free.`, handTyped),
    ).toBe(true);
  });

  it("rejects a message that lost the booking link", () => {
    const withLink: PersonaliseInput = {
      ...BASE,
      context: { ...BASE.context, bookingUrl: "https://casdey.com/book/abc123" },
    };
    expect(acceptable(GOOD, withLink)).toBe(false);
    expect(
      acceptable(`${GOOD}\n\nhttps://casdey.com/book/abc123`, withLink),
    ).toBe(true);
  });

  it("rejects an unfilled placeholder", () => {
    expect(acceptable("Hi {{first_name}}, we would love to see you again soon.", BASE)).toBe(
      false,
    );
  });

  it("rejects the model talking about the task instead of doing it", () => {
    expect(
      acceptable(
        "Here is a personalised message for Marco: Hi Marco, come back in soon and see how you get on.",
        BASE,
      ),
    ).toBe(false);
  });

  it("rejects markdown, which no gym owner types into an email", () => {
    expect(acceptable(`## Come back\n\n${GOOD}`, BASE)).toBe(false);
    expect(acceptable(`**Marco**, ${GOOD}`, BASE)).toBe(false);
  });

  it("rejects an em dash, because casdey's copy never uses one", () => {
    expect(
      acceptable(
        "Hi Marco, it has been a while — we would love to see you back at Iron Works Gym whenever suits you.",
        BASE,
      ),
    ).toBe(false);
  });
});
