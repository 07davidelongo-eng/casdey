import { describe, expect, it } from "vitest";

import {
  isCancellationReason,
  isKnownReason,
  labelForReason,
  phraseForReason,
  REASON_KEY_PATTERN,
  REASON_LABELS,
  REASON_OPTIONS,
  reasonKeyFrom,
  resolveReasons,
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

describe("custom reasons (#33)", () => {
  const custom = [
    { key: "childcare", label: "Childcare fell through", phrase: "the childcare" },
    { key: "shift_work", label: "Shifts changed", phrase: "your shifts changing" },
  ];

  it("keeps the six built-ins and appends the gym's own", () => {
    const reasons = resolveReasons(custom);
    expect(reasons.map((r) => r.value)).toEqual([
      "price",
      "relocation",
      "dissatisfaction",
      "health",
      "no_time",
      "childcare",
      "shift_work",
      "other",
    ]);
  });

  it("keeps 'Something else' last, because it is the fallback", () => {
    expect(resolveReasons(custom).at(-1)?.value).toBe("other");
    expect(resolveReasons([]).at(-1)?.value).toBe("other");
  });

  it("marks which ones a gym is allowed to delete", () => {
    const reasons = resolveReasons(custom);
    expect(reasons.find((r) => r.value === "price")?.builtIn).toBe(true);
    expect(reasons.find((r) => r.value === "childcare")?.builtIn).toBe(false);
  });

  it("reads a custom reason back in the gym's own words", () => {
    const reasons = resolveReasons(custom);
    expect(phraseForReason(reasons, "childcare")).toBe("the childcare");
    expect(labelForReason(reasons, "childcare")).toBe("Childcare fell through");
  });

  it("never leaks a raw key into a member's message", () => {
    // A reason deleted after members were tagged with it still has to render
    // as something a person would say.
    const reasons = resolveReasons([]);
    expect(phraseForReason(reasons, "shift_work")).toBe(REASON_LABELS.other);
  });

  it("returns null when no reason is recorded", () => {
    expect(phraseForReason(resolveReasons([]), null)).toBeNull();
    expect(labelForReason(resolveReasons([]), null)).toBeNull();
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

  it("knows which reasons this gym can use", () => {
    const reasons = resolveReasons(custom);
    expect(isKnownReason(reasons, "childcare")).toBe(true);
    expect(isKnownReason(reasons, "price")).toBe(true);
    expect(isKnownReason(reasons, "nonsense")).toBe(false);
  });
});
