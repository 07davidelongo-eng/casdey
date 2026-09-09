import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { lapsedOpportunity, median, NO_OPPORTUNITY } from "./opportunity";

/**
 * Stand-in for the single services query. The chain is
 * .select().eq().eq().gt() and then awaited.
 */
function fakeClient(rows: unknown[] | { error: { message: string } }): SupabaseClient {
  const result = Array.isArray(rows)
    ? { data: rows, error: null }
    : { data: null, error: rows.error };
  const chain = {
    select: () => chain,
    eq: () => chain,
    gt: () => chain,
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const svc = (
  price_minor: number,
  billing_period: string,
  billing_interval = 1,
) => ({ price_minor, billing_period, billing_interval });

describe("median", () => {
  it("takes the middle value for an odd count", () => {
    expect(median([40_00, 50_00, 90_00])).toBe(50_00);
  });

  it("averages the two middle values for an even count", () => {
    expect(median([40_00, 50_00, 60_00, 90_00])).toBe(55_00);
  });

  it("is unmoved by one outlier", () => {
    // One €400 plan among €40 memberships must not become "typical".
    expect(median([40_00, 40_00, 45_00, 400_00])).toBe(42_50);
  });

  it("is zero for no values", () => {
    expect(median([])).toBe(0);
  });
});

describe("lapsedOpportunity", () => {
  it("multiplies the median monthly membership by the lapsed count", async () => {
    const result = await lapsedOpportunity(
      fakeClient([svc(40_00, "monthly"), svc(50_00, "monthly"), svc(90_00, "monthly")]),
      "gym-1",
      30,
    );
    expect(result.priced).toBe(true);
    expect(result.typicalMonthlyMinor).toBe(50_00);
    expect(result.lapsedMembers).toBe(30);
    expect(result.monthlyMinor).toBe(50_00 * 30);
  });

  it("reduces every billing period to a monthly figure", async () => {
    // Weekly €10 -> €43.33/mo, annual €600 -> €50/mo, monthly €45 -> €45/mo.
    const result = await lapsedOpportunity(
      fakeClient([svc(10_00, "weekly"), svc(600_00, "annual"), svc(45_00, "monthly")]),
      "gym-1",
      1,
    );
    expect(result.typicalMonthlyMinor).toBe(4500);
    expect(result.monthlyMinor).toBe(4500);
  });

  it("honours the billing interval", async () => {
    // €120 charged every 3 months is €40/mo.
    const result = await lapsedOpportunity(
      fakeClient([svc(120_00, "monthly", 3)]),
      "gym-1",
      10,
    );
    expect(result.typicalMonthlyMinor).toBe(40_00);
    expect(result.monthlyMinor).toBe(400_00);
  });

  it("ignores one-off services", async () => {
    const result = await lapsedOpportunity(
      fakeClient([svc(20_00, "one_off"), svc(30_00, "one_off"), svc(60_00, "monthly")]),
      "gym-1",
      5,
    );
    expect(result.typicalMonthlyMinor).toBe(60_00);
    expect(result.monthlyMinor).toBe(300_00);
  });

  it("returns nothing when the gym has no recurring membership priced", async () => {
    const result = await lapsedOpportunity(
      fakeClient([svc(20_00, "one_off")]),
      "gym-1",
      40,
    );
    expect(result).toEqual(NO_OPPORTUNITY);
  });

  it("returns nothing on a read error rather than a fabricated figure", async () => {
    const result = await lapsedOpportunity(
      fakeClient({ error: { message: "boom" } }),
      "gym-1",
      40,
    );
    expect(result).toEqual(NO_OPPORTUNITY);
  });

  it("still reports zero cleanly when there are no lapsed members", async () => {
    const result = await lapsedOpportunity(
      fakeClient([svc(50_00, "monthly")]),
      "gym-1",
      0,
    );
    expect(result.priced).toBe(true);
    expect(result.monthlyMinor).toBe(0);
  });
});
