import { describe, expect, it } from "vitest";

import { recoveredRevenue, NO_REVENUE } from "./revenue";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A stand-in for the one query recoveredRevenue makes. The chain is short and
 * fixed, so faking it is cheaper and clearer than a database.
 */
function fakeClient(rows: unknown[]): SupabaseClient {
  const result = { data: rows, error: null };
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    gte: () => chain,
    lte: () => chain,
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const monthly = (value: number) => ({
  value_minor: value,
  services: { billing_period: "monthly" as const },
});

const oneOff = (value: number) => ({
  value_minor: value,
  services: { billing_period: "one_off" as const },
});

describe("recoveredRevenue", () => {
  it("adds up what was really booked, one booking at a time", async () => {
    // Davide's own example: a 50 euro membership, a 20 euro yoga class and a
    // 30 euro aquagym session are 100 euros, not three times an average.
    const revenue = await recoveredRevenue(
      fakeClient([monthly(5000), oneOff(2000), oneOff(3000)]),
      "gym-1",
    );
    expect(revenue.totalMinor).toBe(10000);
    expect(revenue.bookings).toBe(3);
  });

  it("keeps recurring and one-off apart", async () => {
    const revenue = await recoveredRevenue(
      fakeClient([monthly(5000), oneOff(2000)]),
      "gym-1",
    );
    expect(revenue.recurringMinor).toBe(5000);
    expect(revenue.oneOffMinor).toBe(2000);
  });

  it("projects only the recurring part over a year", async () => {
    const revenue = await recoveredRevenue(
      fakeClient([monthly(5000), oneOff(2000)]),
      "gym-1",
    );
    // The single class does not repeat, so it is not multiplied by anything.
    expect(revenue.annualisedRecurringMinor).toBe(5000 * 12);
  });

  it("counts a booking with no service but never values it", async () => {
    // Guessing here would put an invented number inside the figure the
    // guarantee pays out against.
    const revenue = await recoveredRevenue(
      fakeClient([monthly(5000), { value_minor: null, services: null }]),
      "gym-1",
    );
    expect(revenue.totalMinor).toBe(5000);
    expect(revenue.bookings).toBe(2);
    expect(revenue.unpriced).toBe(1);
  });

  it("treats a free service as unpriced rather than as revenue", async () => {
    const revenue = await recoveredRevenue(
      fakeClient([oneOff(0)]),
      "gym-1",
    );
    expect(revenue.totalMinor).toBe(0);
    expect(revenue.unpriced).toBe(1);
  });

  it("reads an embedded service that arrives as an array", async () => {
    // PostgREST types a one-to-one embed as an array.
    const revenue = await recoveredRevenue(
      fakeClient([
        { value_minor: 4000, services: [{ billing_period: "monthly" }] },
      ]),
      "gym-1",
    );
    expect(revenue.totalMinor).toBe(4000);
    expect(revenue.recurringMinor).toBe(4000);
  });

  it("is zero, not broken, for a gym that has recovered nobody", async () => {
    expect(await recoveredRevenue(fakeClient([]), "gym-1")).toEqual(NO_REVENUE);
  });
});
