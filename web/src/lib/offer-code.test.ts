import { describe, expect, it } from "vitest";

import { normaliseCode, offerCode, offerCodeMatches } from "./offer-code";

const TOKEN = "08867615-2a84-4b5d-a807-b20f198b18ee";
const OTHER = "1f2e3d4c-5b6a-4798-8765-43210fedcba9";

describe("offerCode", () => {
  it("is stable for the same member", () => {
    expect(offerCode(TOKEN)).toBe(offerCode(TOKEN));
  });

  it("differs between members", () => {
    expect(offerCode(TOKEN)).not.toBe(offerCode(OTHER));
  });

  it("is grouped and uses only the unambiguous alphabet", () => {
    const code = offerCode(TOKEN);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$/);
  });

  it("never contains the characters people misread", () => {
    // I, L, O and U are excluded on purpose: a code read down a phone must not
    // turn a 1 into an I or a 0 into an O.
    for (let i = 0; i < 400; i += 1) {
      expect(offerCode(`token-${i}`)).not.toMatch(/[ILOU]/);
    }
  });

  it("does not leak the booking token", () => {
    const code = normaliseCode(offerCode(TOKEN));
    expect(TOKEN.toUpperCase()).not.toContain(code);
  });
});

describe("offerCodeMatches", () => {
  it("forgives case, spaces and the dash", () => {
    const code = offerCode(TOKEN);
    expect(offerCodeMatches(TOKEN, code)).toBe(true);
    expect(offerCodeMatches(TOKEN, code.toLowerCase())).toBe(true);
    expect(offerCodeMatches(TOKEN, code.replace("-", ""))).toBe(true);
    expect(offerCodeMatches(TOKEN, ` ${code.replace("-", " ")} `)).toBe(true);
  });

  it("rejects another member's code", () => {
    expect(offerCodeMatches(TOKEN, offerCode(OTHER))).toBe(false);
  });

  it("rejects nonsense", () => {
    expect(offerCodeMatches(TOKEN, "")).toBe(false);
    expect(offerCodeMatches(TOKEN, "ABC-123")).toBe(
      offerCode(TOKEN) === "ABC-123",
    );
  });
});
