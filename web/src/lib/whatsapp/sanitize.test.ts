import { describe, expect, it } from "vitest";

import { sanitizeReply } from "./sanitize";

describe("sanitizeReply", () => {
  it("passes a normal, safe reply through unchanged", () => {
    const reply =
      "Great to hear from you! Would you like to pop back in this week? I can get someone to sort a time with you.";
    expect(sanitizeReply(reply)).toBe(reply);
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeReply("  hello there  ")).toBe("hello there");
  });

  it("drops an empty or whitespace-only reply", () => {
    expect(sanitizeReply("")).toBe("");
    expect(sanitizeReply("   \n  ")).toBe("");
  });

  it("drops a reply that invents a specific time", () => {
    expect(sanitizeReply("Sure, come in at 6pm and we'll see you then.")).toBe("");
    expect(
      sanitizeReply("We have a slot Tuesday at 7 that would suit you."),
    ).toBe("");
  });

  it("drops a reply that invents a price", () => {
    expect(sanitizeReply("It's £29 a month if you rejoin now.")).toBe("");
    expect(sanitizeReply("Membership is 40 euros monthly.")).toBe("");
  });

  it("drops a reply that gives training or injury advice", () => {
    expect(
      sanitizeReply("For your knee you should rest it for two weeks first."),
    ).toBe("");
    expect(
      sanitizeReply("I'd recommend stretching every morning before you come."),
    ).toBe("");
  });

  it("drops an over-long reply", () => {
    expect(sanitizeReply("a".repeat(701))).toBe("");
  });

  it("keeps a reply that mentions booking without naming a time", () => {
    const reply =
      "Happy to get you booked in. Someone from the gym will message you to arrange a time that works.";
    expect(sanitizeReply(reply)).toBe(reply);
  });
});
