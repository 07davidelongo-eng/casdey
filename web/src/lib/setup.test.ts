import { describe, expect, it } from "vitest";

import { buildSetupState, type SetupInput } from "./setup";

const base: SetupInput = {
  memberCount: 0,
  servicesPriced: false,
  ruleDescription: "no visit for 6 months, and at most 2 visits on record",
  lapseRuleChosen: false,
  offerChosen: false,
  sendingConfigured: true,
  sendingVerified: false,
  calendarConfigured: true,
  calendarConnected: false,
  hasApprovedCampaign: false,
};

describe("buildSetupState", () => {
  it("marks nothing done for a brand-new gym", () => {
    const state = buildSetupState(base);
    expect(state.doneCount).toBe(0);
    expect(state.complete).toBe(false);
    expect(state.steps.find((s) => s.key === "import")?.done).toBe(false);
  });

  it("ticks import once a list exists, but not the lapse rule", () => {
    const state = buildSetupState({ ...base, memberCount: 12 });
    expect(state.steps.find((s) => s.key === "import")?.done).toBe(true);
    // Importing is not choosing. This step used to tick itself off here, on
    // the reasoning that a sensible default was already in effect, which is
    // how a gym could sit on the old 12-month dental window with the
    // checklist reporting it reviewed. See 0037.
    expect(state.steps.find((s) => s.key === "lapse")?.done).toBe(false);
    expect(state.doneCount).toBe(1);
    expect(state.complete).toBe(false);
  });

  it("ticks the lapse step only when the gym has actually chosen", () => {
    const inherited = buildSetupState({ ...base, memberCount: 12 });
    const chosen = buildSetupState({
      ...base,
      memberCount: 12,
      lapseRuleChosen: true,
    });
    expect(inherited.steps.find((s) => s.key === "lapse")?.done).toBe(false);
    expect(chosen.steps.find((s) => s.key === "lapse")?.done).toBe(true);
    expect(chosen.doneCount).toBe(inherited.doneCount + 1);
  });

  it("asks for a decision before it has one, and confirms it after", () => {
    const ask = buildSetupState(base).steps.find((s) => s.key === "lapse");
    const confirm = buildSetupState({
      ...base,
      lapseRuleChosen: true,
    }).steps.find((s) => s.key === "lapse");

    expect(ask?.title).toBe("Say what counts as lapsed");
    expect(ask?.body).toContain("a guess about your gym");
    expect(confirm?.title).toBe("Check how you define lapsed");
    expect(confirm?.body).toContain("Currently:");
  });

  it("is complete when every required step is done, even without a calendar", () => {
    const state = buildSetupState({
      ...base,
      memberCount: 12,
      lapseRuleChosen: true,
      servicesPriced: true,
      offerChosen: true,
      hasApprovedCampaign: true,
      calendarConnected: false,
      sendingVerified: false,
    });
    // Calendar and per-gym sending are both optional, so completion does not
    // wait on either.
    expect(state.complete).toBe(true);
  });

  it("will not call setup complete while there is no offer", () => {
    const withoutOffer = buildSetupState({
      ...base,
      memberCount: 12,
      servicesPriced: true,
      hasApprovedCampaign: true,
    });
    // A win-back message with nothing to come back for recovers nobody, and on
    // Pro that failure is casdey's to refund. The gym has to decide.
    expect(withoutOffer.complete).toBe(false);
    expect(withoutOffer.steps.find((s) => s.key === "offer")?.optional).toBe(
      false,
    );
  });

  it("puts the offer ahead of the campaign it goes into", () => {
    const keys = buildSetupState(base).steps.map((s) => s.key);
    expect(keys.indexOf("offer")).toBeLessThan(keys.indexOf("campaign"));
  });

  it("counts sending only once the domain is verified, never pending", () => {
    const pending = buildSetupState({ ...base, sendingVerified: false });
    const verified = buildSetupState({ ...base, sendingVerified: true });
    expect(pending.steps.find((s) => s.key === "sending")?.done).toBe(false);
    expect(verified.steps.find((s) => s.key === "sending")?.done).toBe(true);
    expect(verified.doneCount).toBe(pending.doneCount + 1);
  });

  it("does not count the sending step when the server cannot offer it", () => {
    const available = buildSetupState({ ...base, sendingConfigured: true });
    const unavailable = buildSetupState({ ...base, sendingConfigured: false });
    expect(available.total).toBe(unavailable.total + 1);
    expect(unavailable.steps.find((s) => s.key === "sending")?.unavailable).toBe(
      true,
    );
  });

  it("does not count the calendar step when the server cannot offer it", () => {
    const available = buildSetupState({ ...base, calendarConfigured: true });
    const unavailable = buildSetupState({ ...base, calendarConfigured: false });
    expect(available.total).toBe(unavailable.total + 1);
    expect(
      unavailable.steps.find((s) => s.key === "calendar")?.unavailable,
    ).toBe(true);
  });

  it("counts a connected calendar toward doneCount when available", () => {
    const state = buildSetupState({
      ...base,
      memberCount: 12,
      lapseRuleChosen: true,
      calendarConnected: true,
    });
    // import + lapse + calendar
    expect(state.doneCount).toBe(3);
  });

  it("reflects the gym's own lapse rule in the copy", () => {
    const state = buildSetupState({
      ...base,
      lapseRuleChosen: true,
      ruleDescription: "no visit for 3 months, and at most 1 visit on record",
    });
    const lapse = state.steps.find((s) => s.key === "lapse");
    expect(lapse?.body).toContain("3 months");
    expect(lapse?.body).toContain("1 visit");
  });
});
