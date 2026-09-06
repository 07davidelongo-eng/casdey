import { describe, expect, it } from "vitest";

import { offerForMember, parseVariants, REASON_TO_LAPSE } from "./variants";

const PRICE = {
  text: "Come back on half price for two months.",
  expiresAt: null,
  offerId: null,
};

describe("parseVariants", () => {
  it("reads what the gym wrote", () => {
    expect(parseVariants({ price: PRICE })).toEqual({ price: PRICE });
  });

  it("ignores anything that is not an object of reasons", () => {
    expect(parseVariants(null)).toEqual({});
    expect(parseVariants([PRICE])).toEqual({});
    expect(parseVariants("half price")).toEqual({});
  });

  it("keeps an offer written for a reason the gym invented", () => {
    // Changed by #33. This used to drop anything outside casdey's six, which
    // would now silently discard the offer a gym wrote for its own reason.
    expect(parseVariants({ childcare: PRICE })).toEqual({ childcare: PRICE });
  });

  it("still drops a key no reason could ever have", () => {
    // The shape rule is the one the database enforces, so a malformed blob
    // cannot introduce a key nothing else in the app would recognise.
    expect(parseVariants({ "Vibes!": PRICE })).toEqual({});
    expect(parseVariants({ "": PRICE })).toEqual({});
    expect(parseVariants({ A: PRICE })).toEqual({});
  });

  it("drops an empty offer rather than promising a member nothing", () => {
    expect(parseVariants({ price: { ...PRICE, text: "   " } })).toEqual({});
  });
});

describe("offerForMember", () => {
  const variants = parseVariants({ price: PRICE });

  it("uses the offer written for why they left", () => {
    expect(offerForMember(variants, "General offer", "price")).toBe(PRICE.text);
  });

  it("falls back to the general offer for a reason with no variant", () => {
    expect(offerForMember(variants, "General offer", "health")).toBe(
      "General offer",
    );
  });

  it("falls back for a member whose reason nobody recorded", () => {
    expect(offerForMember(variants, "General offer", null)).toBe(
      "General offer",
    );
  });

  it("returns nothing when the gym has written no offer at all", () => {
    // Not a failure: a campaign with no offer is a plain check-in, which is
    // the right message for a gym that has not decided what it can give away.
    expect(offerForMember({}, null, "price")).toBeNull();
  });
});

describe("REASON_TO_LAPSE", () => {
  it("maps every reason staff can record onto the offer library", () => {
    // Two vocabularies written months apart for different jobs. A gap here
    // means a member's recorded reason silently matches no offer.
    for (const value of Object.values(REASON_TO_LAPSE)) {
      expect(typeof value).toBe("string");
    }
    expect(REASON_TO_LAPSE.relocation).toBe("moved");
    expect(REASON_TO_LAPSE.health).toBe("injury");
    expect(REASON_TO_LAPSE.no_time).toBe("time");
  });
});
