import { describe, expect, it } from "vitest";

import { buildSetupState, type SetupInput } from "./setup";

const base: SetupInput = {
  memberCount: 0,
  bookingValueSet: false,
  lapsedAfterMonths: 6,
  maxVisits: 2,
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

  it("ticks import and lapse together once a list exists", () => {
    const state = buildSetupState({ ...base, memberCount: 12 });
    expect(state.steps.find((s) => s.key === "import")?.done).toBe(true);
    // The lapse window has a working default the moment there are members.
    expect(state.steps.find((s) => s.key === "lapse")?.done).toBe(true);
    expect(state.doneCount).toBe(2);
    expect(state.complete).toBe(false);
  });

  it("is complete when every required step is done, even without a calendar", () => {
    const state = buildSetupState({
      ...base,
      memberCount: 12,
      bookingValueSet: true,
      hasApprovedCampaign: true,
      calendarConnected: false,
    });
    // Calendar is optional, so completion does not wait on it.
    expect(state.complete).toBe(true);
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
      calendarConnected: true,
    });
    // import + lapse + calendar
    expect(state.doneCount).toBe(3);
  });

  it("reflects the gym's own lapse rule in the copy", () => {
    const state = buildSetupState({
      ...base,
      lapsedAfterMonths: 3,
      maxVisits: 1,
    });
    const lapse = state.steps.find((s) => s.key === "lapse");
    expect(lapse?.body).toContain("3 months");
    expect(lapse?.body).toContain("one visit");
  });
});
