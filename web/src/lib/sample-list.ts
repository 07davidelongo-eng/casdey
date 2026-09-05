/**
 * A deterministic sample member list, for the marketing hero only.
 *
 * The hero draws a real gym's problem rather than describing it: a member
 * list sorted by time since last visit, one row per member, each row being
 * the signature from the brand guide (visits, then a long silence). Sorted
 * that way, the boundary between the visits and the silence traces the shape
 * every gym list has, which is the entire argument for the product.
 *
 * The numbers are invented and the hero labels them as illustrative. What
 * must not be invented is the SHAPE, so the distribution below is the one
 * the pitch actually claims: a small block of members who were in this month,
 * then a long tail out past three years.
 *
 * Generated from a fixed seed rather than Math.random, because this renders
 * on the server and again on the client, and two different lists would be a
 * hydration error.
 */

/** How many months of history a row covers, left edge to right edge. */
export const WINDOW_MONTHS = 42;

export type SampleMember = {
  /** Whole months since the last visit. 0 means they were in this month. */
  silence: number;
  /** Months after the left edge when they joined. */
  joined: number;
  /** Every visit, in months from the left edge, oldest first. */
  visits: number[];
  /** The few casdey has already brought back. Drawn in Amber, nothing else is. */
  returned: boolean;
};

/** mulberry32. Small, fast, and stable across runs, which is the only requirement. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(count: number): SampleMember[] {
  const rand = seeded(20260905);
  const rows: SampleMember[] = [];

  for (let i = 0; i < count; i += 1) {
    // Row 0 is the longest-lapsed and the last row was in this month. The
    // exponent is what makes it a tail rather than a ramp: quiet members
    // outnumber active ones, and that is the whole opportunity.
    const t = i / (count - 1);
    const silence = Math.round(
      (WINDOW_MONTHS - 6) * Math.pow(1 - t, 1.75) * (0.88 + rand() * 0.24),
    );
    const lastVisit = Math.max(1.5, WINDOW_MONTHS - silence);

    // Somebody who has been a member for years shows a longer run of visits
    // than somebody who joined and drifted off after a month, and the wall
    // should show both.
    const tenure = 3 + rand() * 26;
    const joined = Math.max(0.5, lastVisit - tenure);
    const cadence = 0.95 + rand() * 2.4;

    const visits: number[] = [];
    for (let m = joined; m <= lastVisit + 0.001; m += cadence) {
      visits.push(Math.min(m, lastVisit));
      if (visits.length >= 20) break;
    }
    if (visits[visits.length - 1] !== lastVisit) visits.push(lastVisit);

    rows.push({ silence, joined, visits, returned: false });
  }

  // A handful already brought back, taken from the winnable band rather than
  // from the deepest part of the tail, because that is where reactivation
  // actually lands.
  const winnable = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.silence >= 7 && row.silence <= 26);
  for (const step of [2, 5, 9, 14, 19]) {
    const pick = winnable[step % winnable.length];
    if (pick) pick.row.returned = true;
  }

  return rows;
}

export const SAMPLE_LIST = build(52);
