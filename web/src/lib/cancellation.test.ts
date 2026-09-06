import { describe, expect, it } from "vitest";

import {
  DEFAULT_REASONS,
  isCancellationReason,
  isKnownReason,
  labelForReason,
  phraseForReason,
  REASON_KEY_PATTERN,
  REASON_LABELS,
  REASON_OPTIONS,
  reasonKeyFrom,
  type ResolvedReason,
} from "./cancellation";

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

describe("reasons a gym owns (#33, reworked by #46)", () => {
  const reasons: ResolvedReason[] = [
    { value: "price", label: "Too expensive", phrase: "the price" },
    { value: "childcare", label: "Childcare fell through", phrase: "the childcare" },
  ];

  it("ships six defaults to seed a new gym with", () => {
    expect(DEFAULT_REASONS.map((r) => r.value)).toEqual(
      REASON_OPTIONS.map((o) => o.value),
    );
    for (const reason of DEFAULT_REASONS) {
      expect(reason.phrase.length).toBeGreaterThan(3);
    }
  });

  it("reads a reason back in whatever the gym now calls it", () => {
    // 'price' is a default the gym has renamed. The key is untouched, so every
    // member recorded against it months ago still resolves.
    expect(labelForReason(reasons, "price")).toBe("Too expensive");
    expect(labelForReason(reasons, "childcare")).toBe("Childcare fell through");
  });

  it("never leaks a raw key into a member's message", () => {
    // The path a deleted reason takes: the member keeps the tag, and casdey
    // says something a person would say rather than "shift_work".
    expect(phraseForReason(reasons, "shift_work")).toBe(REASON_LABELS.other);
  });

  it("returns null when no reason is recorded", () => {
    expect(phraseForReason(reasons, null)).toBeNull();
    expect(labelForReason(reasons, null)).toBeNull();
  });

  it("knows which reasons this gym can use", () => {
    expect(isKnownReason(reasons, "childcare")).toBe(true);
    expect(isKnownReason(reasons, "relocation")).toBe(false);
    expect(isKnownReason(reasons, "nonsense")).toBe(false);
  });

  it("builds a usable key from what the gym typed", () => {
    expect(reasonKeyFrom("Childcare fell through")).toBe("childcare_fell_through");
    expect(reasonKeyFrom("Went to  the competitor!")).toBe("went_to_the_competitor");
    expect(reasonKeyFrom("Prezzo troppo caro")).toBe("prezzo_troppo_caro");
  });

  it("refuses a label that cannot become a key", () => {
    expect(reasonKeyFrom("!!!")).toBe("");
    expect(reasonKeyFrom("")).toBe("");
    expect(reasonKeyFrom("123")).toBe("");
  });

  it("only accepts keys the database would accept", () => {
    expect(REASON_KEY_PATTERN.test(reasonKeyFrom("Childcare"))).toBe(true);
    expect(REASON_KEY_PATTERN.test("Childcare")).toBe(false);
    expect(REASON_KEY_PATTERN.test("a")).toBe(false);
  });
});
