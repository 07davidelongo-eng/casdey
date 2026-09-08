import "server-only";

import { change } from "./dashboard";
import { periodBuckets } from "./admin-period";

/**
 * Reading numbers back out of PostHog for /admin.
 *
 * Two hosts are involved, and mixing them up fails silently rather than
 * loudly: NEXT_PUBLIC_POSTHOG_HOST (e.g. https://eu.i.posthog.com) is the
 * ingestion-only host events are sent to, and the private REST API this file
 * calls (POSTHOG_PROJECT_ID + POSTHOG_PERSONAL_API_KEY) lives on the
 * corresponding app host instead (https://eu.posthog.com) — PostHog's own
 * docs: "eu.i.posthog.com for public endpoints and eu.posthog.com for
 * private ones." The ".i." is the whole difference, so it is stripped rather
 * than hand-maintaining a second host env var that could drift from the first.
 *
 * Everything here returns null (never a fake zero) when PostHog is not
 * configured or a request fails: /admin then says so in words instead of
 * drawing a chart that looks real but is not.
 */
function appHost(): string | null {
  const ingestHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!ingestHost) return null;
  return ingestHost.replace(".i.posthog.com", ".posthog.com");
}

function configured(): { host: string; projectId: string; key: string } | null {
  const host = appHost();
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!host || !projectId || !key) return null;
  return { host, projectId, key };
}

/** Runs one HogQL query and returns its rows, or null if PostHog is not
 *  configured or the request fails. Every caller treats null as "nothing to
 *  show", never as zero. */
async function hogql(query: string): Promise<unknown[][] | null> {
  const config = configured();
  if (!config) return null;

  try {
    const response = await fetch(
      `${config.host}/api/projects/${config.projectId}/query/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.key}`,
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(
        "[posthog-query] request failed",
        response.status,
        await response.text().catch(() => ""),
      );
      return null;
    }

    const body = (await response.json()) as { results?: unknown[][] };
    return body.results ?? [];
  } catch (error) {
    console.error("[posthog-query] request threw", error);
    return null;
  }
}

/** Whether the read side is wired at all. Lets /admin show one "not connected"
 *  note for the whole PostHog section rather than one per empty card. */
export function posthogConfigured(): boolean {
  return configured() !== null;
}

type Bucket = "day" | "week";
const DEFAULT_DAYS = 84;

/* ------------------------------------------------------------------ */
/* Visitors and pageviews, over the period                            */
/* ------------------------------------------------------------------ */

export type VisitorWeek = {
  key: string;
  label: string;
  visitors: number;
  views: number;
};

export type VisitorTrend = {
  current: VisitorWeek[];
  previous: VisitorWeek[];
  totalCurrent: number;
  totalPrevious: number;
  changePercent: number | null;
  viewsCurrent: number;
  viewsPrevious: number;
  viewsChangePercent: number | null;
};

/**
 * Unique visitors (by PostHog's cookieless hash, not a real person, but the
 * closest honest proxy) and raw pageviews per bucket, the last `days` days
 * against the `days` before — the same shape gymSignupTrend() in
 * admin-stats.ts returns, so the two can sit side by side and mean the same
 * bucket.
 *
 * The DISTINCT count is done in HogQL at the right granularity (toStartOfDay /
 * toMonday), not summed from daily rows in JS — a week's uniques is not the
 * sum of its days' uniques. PostHog's GROUP BY only returns buckets that had a
 * pageview, so the rows are re-indexed onto a fixed, gap-free list: an empty
 * bucket must read as zero, not fall out of the axis.
 */
export async function visitorTrend(
  days = DEFAULT_DAYS,
  bucket: Bucket = "week",
  now: Date = new Date(),
): Promise<VisitorTrend | null> {
  const groupExpr =
    bucket === "day" ? "toStartOfDay(timestamp)" : "toMonday(timestamp)";
  const rows = await hogql(`
    SELECT ${groupExpr} AS b,
           count(DISTINCT distinct_id) AS visitors,
           count() AS views
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days * 2} DAY
    GROUP BY b
    ORDER BY b
  `);
  if (rows === null) return null;

  const byBucket = new Map(
    rows.map((row) => [
      String(row[0]).slice(0, 10),
      { visitors: Number(row[1]), views: Number(row[2]) },
    ]),
  );

  const { all: anchors, perSide } = periodBuckets(days, bucket, now);
  const all: VisitorWeek[] = anchors.map((a) => {
    const hit = byBucket.get(a.key);
    return {
      key: a.key,
      label: a.label,
      visitors: hit?.visitors ?? 0,
      views: hit?.views ?? 0,
    };
  });

  const current = all.slice(perSide);
  const previous = all.slice(0, perSide);
  const sum = (arr: VisitorWeek[], k: "visitors" | "views") =>
    arr.reduce((total, week) => total + week[k], 0);

  const totalCurrent = sum(current, "visitors");
  const totalPrevious = sum(previous, "visitors");
  const viewsCurrent = sum(current, "views");
  const viewsPrevious = sum(previous, "views");

  return {
    current,
    previous,
    totalCurrent,
    totalPrevious,
    changePercent: change(totalCurrent, totalPrevious),
    viewsCurrent,
    viewsPrevious,
    viewsChangePercent: change(viewsCurrent, viewsPrevious),
  };
}

/* ------------------------------------------------------------------ */
/* Ranked breakdowns: pages, referrers, countries, devices           */
/* ------------------------------------------------------------------ */

export type RankedRow = { label: string; value: number };

/**
 * The client captures $current_url as a bare path (see posthog-provider.tsx),
 * so there is no host to strip, only a trailing ?query. splitByChar returns a
 * 1-indexed array; [1] is the part before the first '?'.
 */
const PAGE_EXPR = "splitByChar('?', coalesce(properties.$current_url, ''))[1]";

async function ranked(
  query: string,
  blankAs: string,
): Promise<RankedRow[] | null> {
  const rows = await hogql(query);
  if (rows === null) return null;
  return rows
    .map(([label, value]) => {
      const text =
        label == null || label === "" || label === "$direct"
          ? blankAs
          : String(label);
      return { label: text, value: Number(value) };
    })
    .filter((row) => Number.isFinite(row.value) && row.value > 0);
}

/** Most-viewed paths, last `days` days. */
export function topPages(days = 84, limit = 12): Promise<RankedRow[] | null> {
  return ranked(
    `
    SELECT ${PAGE_EXPR} AS page, count() AS views
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY page
    ORDER BY views DESC
    LIMIT ${limit}
    `,
    "/",
  );
}

/** Where visitors came from, by referring domain. $direct (typed the URL or a
 *  bookmark) is folded into one honest bucket rather than dropped. */
export function topReferrers(
  days = 84,
  limit = 12,
): Promise<RankedRow[] | null> {
  return ranked(
    `
    SELECT properties.$referring_domain AS ref,
           count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY ref
    ORDER BY visitors DESC
    LIMIT ${limit}
    `,
    "Direct / none",
  );
}

/** Visitors by country, from PostHog's GeoIP enrichment. */
export function topCountries(
  days = 84,
  limit = 12,
): Promise<RankedRow[] | null> {
  return ranked(
    `
    SELECT properties.$geoip_country_name AS country,
           count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY country
    ORDER BY visitors DESC
    LIMIT ${limit}
    `,
    "Unknown",
  );
}

/** Desktop / Mobile / Tablet split. */
export function deviceMix(days = 84): Promise<RankedRow[] | null> {
  return ranked(
    `
    SELECT properties.$device_type AS device,
           count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY device
    ORDER BY visitors DESC
    `,
    "Unknown",
  );
}

/* ------------------------------------------------------------------ */
/* The checkout half of the funnel                                    */
/* ------------------------------------------------------------------ */

export type CheckoutFunnel = {
  started: number;
  completed: number;
  /** Started, split by the tier the gym picked. */
  startedByTier: RankedRow[];
};

/**
 * How many gyms started a Stripe Checkout versus actually completed one, the
 * last `days` days. Both events are captured server-side keyed on gym.id
 * (see checkout/route.ts and stripe/webhook/route.ts), so — unlike a website
 * visitor, who is anonymous — this pair genuinely is the same gym on both
 * rows, not two numbers assumed to relate.
 */
export async function checkoutFunnel(
  days = 84,
): Promise<CheckoutFunnel | null> {
  const [totals, byTier] = await Promise.all([
    hogql(`
      SELECT event, count(DISTINCT distinct_id) AS gyms
      FROM events
      WHERE event IN ('checkout_started', 'checkout_completed')
        AND timestamp >= now() - INTERVAL ${days} DAY
      GROUP BY event
    `),
    hogql(`
      SELECT properties.tier AS tier, count(DISTINCT distinct_id) AS gyms
      FROM events
      WHERE event = 'checkout_started'
        AND timestamp >= now() - INTERVAL ${days} DAY
      GROUP BY tier
      ORDER BY gyms DESC
    `),
  ]);
  if (totals === null) return null;

  const funnel: CheckoutFunnel = { started: 0, completed: 0, startedByTier: [] };
  for (const [event, count] of totals) {
    if (event === "checkout_started") funnel.started = Number(count);
    if (event === "checkout_completed") funnel.completed = Number(count);
  }
  for (const [tier, count] of byTier ?? []) {
    if (tier == null) continue;
    funnel.startedByTier.push({ label: String(tier), value: Number(count) });
  }
  return funnel;
}
