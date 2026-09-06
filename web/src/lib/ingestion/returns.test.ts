import { describe, expect, it } from "vitest";

import { hasReturnedSinceContact, type ReturnCandidate } from "./returns";

function member(overrides: Partial<ReturnCandidate> = {}): ReturnCandidate {
  return {
    id: "m1",
    status: "contacted",
    contacted_at: "2026-06-01T09:00:00.000Z",
    last_visit_at: "2026-06-14",
    ...overrides,
  };
}

describe("hasReturnedSinceContact", () => {
  it("counts a member who visited after casdey wrote", () => {
    expect(hasReturnedSinceContact(member())).toBe(true);
  });

  it("ignores a member nobody wrote to", () => {
    // Their visit says nothing about casdey either way.
    expect(hasReturnedSinceContact(member({ status: "active" }))).toBe(false);
  });

  it("never claims somebody who opted out", () => {
    expect(hasReturnedSinceContact(member({ status: "opted_out" }))).toBe(false);
  });

  it("does not re-count a member already marked returned", () => {
    expect(hasReturnedSinceContact(member({ status: "returned" }))).toBe(false);
  });

  it("ignores a visit that predates the message", () => {
    expect(
      hasReturnedSinceContact(member({ last_visit_at: "2026-05-20" })),
    ).toBe(false);
  });

  it("excludes a same-day visit", () => {
    // They were already in the building when the message went out, so the
    // message did not bring them back and the guarantee must not count it.
    expect(
      hasReturnedSinceContact(member({ last_visit_at: "2026-06-01" })),
    ).toBe(false);
  });

  it("needs both dates", () => {
    expect(hasReturnedSinceContact(member({ contacted_at: null }))).toBe(false);
    expect(hasReturnedSinceContact(member({ last_visit_at: null }))).toBe(false);
  });

  it("compares dates, not timestamps of different shapes", () => {
    expect(
      hasReturnedSinceContact(
        member({
          contacted_at: "2026-06-01T23:59:59.999Z",
          last_visit_at: "2026-06-02",
        }),
      ),
    ).toBe(true);
  });
});
