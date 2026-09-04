import { describe, expect, it } from "vitest";

import { applyImportCap } from "./cap";
import type { RawMember } from "./types";

function member(overrides: Partial<RawMember> = {}): RawMember {
  return {
    externalRef: null,
    firstName: "A",
    lastName: "B",
    email: null,
    phone: null,
    lastVisitAt: "2024-01-01",
    visitCount: 1,
    sourceRow: 2,
    ...overrides,
  };
}

describe("applyImportCap", () => {
  it("caps nothing when the plan has no limit", () => {
    const members = [member({ email: "a@x.co" }), member({ email: "b@x.co" })];
    const out = applyImportCap(members, {
      limit: null,
      currentTotal: 999,
      existingRefs: new Set(),
      existingEmails: new Set(),
    });
    expect(out.toWrite).toHaveLength(2);
    expect(out.droppedNew).toBe(0);
  });

  it("drops net-new members beyond the remaining capacity", () => {
    const members = [
      member({ email: "a@x.co" }),
      member({ email: "b@x.co" }),
      member({ email: "c@x.co" }),
    ];
    const out = applyImportCap(members, {
      limit: 50,
      currentTotal: 48, // room for 2 more
      existingRefs: new Set(),
      existingEmails: new Set(),
    });
    expect(out.toWrite).toHaveLength(2);
    expect(out.droppedNew).toBe(1);
  });

  it("never blocks updates to members that already exist, even at the cap", () => {
    const members = [
      member({ email: "old1@x.co" }),
      member({ email: "old2@x.co" }),
      member({ email: "new@x.co" }),
    ];
    const out = applyImportCap(members, {
      limit: 50,
      currentTotal: 50, // full: no room for new
      existingRefs: new Set(),
      existingEmails: new Set(["old1@x.co", "old2@x.co"]),
    });
    // Both existing members still go through; only the genuinely-new one drops.
    expect(out.toWrite.map((m) => m.email)).toEqual(["old1@x.co", "old2@x.co"]);
    expect(out.droppedNew).toBe(1);
  });

  it("matches an existing member by external reference too", () => {
    const members = [member({ externalRef: "M-1", email: "x@x.co" })];
    const out = applyImportCap(members, {
      limit: 50,
      currentTotal: 50,
      existingRefs: new Set(["M-1"]),
      existingEmails: new Set(),
    });
    expect(out.toWrite).toHaveLength(1);
    expect(out.droppedNew).toBe(0);
  });

  it("drops all new members when the gym is already over the cap", () => {
    const members = [member({ email: "n1@x.co" }), member({ email: "n2@x.co" })];
    const out = applyImportCap(members, {
      limit: 50,
      currentTotal: 200, // imported during the trial, now on Free
      existingRefs: new Set(),
      existingEmails: new Set(),
    });
    expect(out.toWrite).toHaveLength(0);
    expect(out.droppedNew).toBe(2);
  });
});
