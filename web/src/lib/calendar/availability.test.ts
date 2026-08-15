import { describe, expect, it } from "vitest";

import { openSlots, type Interval, type SlotConfig } from "./availability";
import type { BookingHours } from "../types";

function config(hours: BookingHours, over: Partial<SlotConfig> = {}): SlotConfig {
  return {
    hours,
    timezone: "Europe/London",
    slotMinutes: 60,
    bufferMinutes: 0,
    minNoticeHours: 0,
    horizonDays: 1,
    ...over,
  };
}

const starts = (slots: Interval[]) => slots.map((s) => s.start.toISOString());

// A Monday, 06:00 UTC. London is on BST (UTC+1) in August, so 09:00 local is
// 08:00 UTC. Anchoring every case to this makes the expected instants explicit.
const MONDAY_AUG = new Date("2026-08-17T06:00:00.000Z");

describe("openSlots", () => {
  it("generates back-to-back slots inside a window", () => {
    const slots = openSlots(
      config({ mon: [["09:00", "11:00"]] }),
      [],
      MONDAY_AUG,
    );
    expect(starts(slots)).toEqual([
      "2026-08-17T08:00:00.000Z",
      "2026-08-17T09:00:00.000Z",
    ]);
  });

  it("returns nothing when the day has no hours", () => {
    expect(openSlots(config({ tue: [["09:00", "17:00"]] }), [], MONDAY_AUG)).toEqual(
      [],
    );
  });

  it("drops slots inside the minimum-notice window", () => {
    const slots = openSlots(
      config({ mon: [["09:00", "12:00"]] }, { minNoticeHours: 3 }),
      [],
      MONDAY_AUG, // earliest bookable = 09:00 UTC
    );
    expect(starts(slots)).toEqual([
      "2026-08-17T09:00:00.000Z",
      "2026-08-17T10:00:00.000Z",
    ]);
  });

  it("drops a slot a busy interval overlaps", () => {
    const busy: Interval[] = [
      {
        start: new Date("2026-08-17T09:00:00.000Z"),
        end: new Date("2026-08-17T09:30:00.000Z"),
      },
    ];
    const slots = openSlots(config({ mon: [["09:00", "12:00"]] }), busy, MONDAY_AUG);
    // 09:00 UTC slot is knocked out; the touching 08:00 slot survives.
    expect(starts(slots)).toEqual([
      "2026-08-17T08:00:00.000Z",
      "2026-08-17T10:00:00.000Z",
    ]);
  });

  it("keeps the buffer clear before the next busy block", () => {
    const busy: Interval[] = [
      {
        start: new Date("2026-08-17T10:00:00.000Z"),
        end: new Date("2026-08-17T10:30:00.000Z"),
      },
    ];
    const slots = openSlots(
      config({ mon: [["09:00", "11:00"]] }, { bufferMinutes: 30 }),
      busy,
      MONDAY_AUG,
    );
    // 09:00-10:00 slot + 30m buffer runs into the 10:00 busy block, so it goes;
    // the 08:00 slot (buffer ends 09:30) is clear.
    expect(starts(slots)).toEqual(["2026-08-17T08:00:00.000Z"]);
  });

  it("excludes slots on or after the horizon", () => {
    const slots = openSlots(
      config(
        { mon: [["09:00", "10:00"]], tue: [["09:00", "10:00"]], wed: [["09:00", "10:00"]] },
        { horizonDays: 2 },
      ),
      [],
      MONDAY_AUG, // horizon ends Wed 06:00 UTC, before Wed's 08:00 slot
    );
    expect(starts(slots)).toEqual([
      "2026-08-17T08:00:00.000Z",
      "2026-08-18T08:00:00.000Z",
    ]);
  });

  it("honours multiple windows in one day", () => {
    const slots = openSlots(
      config({ mon: [["09:00", "10:00"], ["14:00", "15:00"]] }),
      [],
      MONDAY_AUG,
    );
    expect(starts(slots)).toEqual([
      "2026-08-17T08:00:00.000Z", // 09:00 BST
      "2026-08-17T13:00:00.000Z", // 14:00 BST
    ]);
  });

  it("drops a window shorter than one slot", () => {
    expect(
      openSlots(config({ mon: [["09:00", "09:20"]] }), [], MONDAY_AUG),
    ).toEqual([]);
  });

  it("shifts with daylight saving: 09:00 local is 09:00 UTC once GMT returns", () => {
    // 2026-10-26 is the Monday after UK clocks go back (25 Oct), so London is
    // on GMT (UTC+0) and 09:00 local is 09:00 UTC, not 08:00 as in August.
    const mondayGmt = new Date("2026-10-26T06:00:00.000Z");
    const slots = openSlots(config({ mon: [["09:00", "10:00"]] }), [], mondayGmt);
    expect(starts(slots)).toEqual(["2026-10-26T09:00:00.000Z"]);
  });

  it("ignores malformed windows without throwing", () => {
    const slots = openSlots(
      config({ mon: [["nope", "11:00"], ["09:00", "10:00"]] }),
      [],
      MONDAY_AUG,
    );
    expect(starts(slots)).toEqual(["2026-08-17T08:00:00.000Z"]);
  });
});
