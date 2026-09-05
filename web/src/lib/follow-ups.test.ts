import { describe, expect, it } from "vitest";

import {
  defaultFollowUps,
  MAX_FOLLOW_UPS,
  nextStep,
  parseFollowUps,
  type FollowUp,
} from "./follow-ups";

const step: FollowUp = { afterDays: 4, subject: "Following up", body: "Hi" };

describe("parseFollowUps", () => {
  it("reads a well-formed sequence", () => {
    expect(parseFollowUps([step])).toEqual([step]);
  });

  it("returns nothing for anything that is not an array", () => {
    // It arrives from jsonb, so it can be literally anything.
    expect(parseFollowUps(null)).toEqual([]);
    expect(parseFollowUps("two")).toEqual([]);
    expect(parseFollowUps({ afterDays: 4 })).toEqual([]);
  });

  it("drops a step with no body rather than sending an empty message", () => {
    expect(parseFollowUps([{ ...step, body: "   " }])).toEqual([]);
  });

  it("drops a step with no subject", () => {
    expect(parseFollowUps([{ ...step, subject: "" }])).toEqual([]);
  });

  it("drops a step due immediately, which would not be a follow-up", () => {
    expect(parseFollowUps([{ ...step, afterDays: 0 }])).toEqual([]);
  });

  it("caps the delay rather than accepting a two-year gap", () => {
    expect(parseFollowUps([{ ...step, afterDays: 900 }])[0]?.afterDays).toBe(60);
  });

  it("refuses to read more steps than casdey will send", () => {
    const many = Array.from({ length: 6 }, () => step);
    expect(parseFollowUps(many)).toHaveLength(MAX_FOLLOW_UPS);
  });
});

describe("nextStep", () => {
  const steps = defaultFollowUps("win_back");

  it("follows the first message with the first follow-up", () => {
    expect(nextStep(steps, 1)?.step).toBe(2);
    expect(nextStep(steps, 1)?.follow).toEqual(steps[0]);
  });

  it("follows the first follow-up with the second", () => {
    expect(nextStep(steps, 2)?.step).toBe(3);
    expect(nextStep(steps, 2)?.follow).toEqual(steps[1]);
  });

  it("ends the sequence rather than running off the end", () => {
    expect(nextStep(steps, 3)).toBeNull();
  });

  it("ends immediately when the gym removed every follow-up", () => {
    expect(nextStep([], 1)).toBeNull();
  });
});

describe("the defaults casdey suggests", () => {
  it("chases a lapsed member twice", () => {
    expect(defaultFollowUps("win_back")).toHaveLength(2);
  });

  it("chases a still-paying member once", () => {
    // Chasing somebody who has not left is a good way to remind them they
    // could.
    expect(defaultFollowUps("at_risk")).toHaveLength(1);
  });

  it("says outright that the last one is the last", () => {
    const final = defaultFollowUps("win_back").at(-1);
    expect(final?.body).toContain("last time I will write");
  });
});
