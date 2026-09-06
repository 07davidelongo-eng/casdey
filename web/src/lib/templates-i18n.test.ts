import { describe, expect, it } from "vitest";

import { LANGUAGES } from "./languages";
import {
  defaultFollowUpsFor,
  defaultMessage,
  templateSet,
} from "./templates-i18n";

const CODES = LANGUAGES.map((l) => l.code);

describe("templates-i18n", () => {
  it("has a written set for every language casdey offers", () => {
    // A language in the dropdown with no copy behind it is the bug this file
    // exists to fix, so the dropdown itself is the test fixture.
    for (const code of CODES) {
      const set = templateSet(code);
      expect(set.winBack.subject.length, code).toBeGreaterThan(5);
      expect(set.winBack.body.length, code).toBeGreaterThan(80);
      expect(set.atRisk.subject.length, code).toBeGreaterThan(5);
      expect(set.atRisk.body.length, code).toBeGreaterThan(80);
    }
  });

  it("actually differs from English", () => {
    for (const code of CODES.filter((c) => c !== "en")) {
      expect(defaultMessage(code, "win_back").body, code).not.toBe(
        defaultMessage("en", "win_back").body,
      );
    }
  });

  it("keeps the merge fields identical in every language", () => {
    // The fields are code, not copy. A translated {{first_name}} silently
    // renders as literal text in somebody's inbox.
    const fields = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
    const reference = fields(defaultMessage("en", "win_back").body);

    for (const code of CODES) {
      expect(fields(defaultMessage(code, "win_back").body), code).toEqual(
        reference,
      );
    }
  });

  it("never uses an em dash, in any language", () => {
    for (const code of CODES) {
      const set = templateSet(code);
      const all = [
        set.winBack.subject,
        set.winBack.body,
        set.atRisk.subject,
        set.atRisk.body,
        ...set.winBackFollowUps.flatMap((f) => [f.subject, f.body]),
        ...set.atRiskFollowUps.flatMap((f) => [f.subject, f.body]),
      ].join(" ");
      expect(all, code).not.toContain("—");
    }
  });

  it("uses only Latin script, so no lookalike characters slipped in", () => {
    // Cyrillic and Greek letters that look identical to Latin ones are the
    // classic hand-typed-translation bug: the word reads correctly and matches
    // nothing.
    for (const code of CODES) {
      const set = templateSet(code);
      const all = JSON.stringify(set);
      expect(all, code).not.toMatch(/[Ͱ-ϿЀ-ӿ]/);
    }
  });

  it("gives win-back two follow-ups and at-risk one, in every language", () => {
    for (const code of CODES) {
      expect(defaultFollowUpsFor(code, "win_back"), code).toHaveLength(2);
      expect(defaultFollowUpsFor(code, "at_risk"), code).toHaveLength(1);
    }
  });

  it("falls back to English for a language it has no copy for", () => {
    expect(defaultMessage("xx", "win_back").body).toBe(
      defaultMessage("en", "win_back").body,
    );
  });
});
