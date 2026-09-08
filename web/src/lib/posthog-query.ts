import "server-only";

import { change } from "./dashboard";

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
 *  show", never as zero: /admin says so explicitly rather than drawing a
 *  false 0% while PostHog is unreachable. */
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

export type VisitorWeek = { weekStart: string; label: string; visitors: number };

export type VisitorTrend = {
  current: VisitorWeek[];
  previous: VisitorWeek[];
  totalCurrent: number;
  totalPrevious: number;
  changePercent: number | null;
};

// Same Monday-start bucketing admin-stats.ts uses, kept local rather than
// imported for the same reason that file gives for not importing
// dashboard.ts's copy: each of these files buckets its own weeks
// independently rather than depending on another module's private helper.
function weekStartOf(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const WEEK_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Unique visitors (by PostHog's cookieless hash, not a real person, but the
 * closest honest proxy) per week, the last `weeks` weeks against the `weeks`
 * before — the same shape signupTrend() in admin-stats.ts returns, so the two
 * can sit side by side as LineCharts and mean the same "week".
 *
 * PostHog's GROUP BY only returns weeks that actually had a pageview, so the
 * raw rows are re-indexed onto a fixed, gap-free week list (toMonday() rather
 * than toStartOfWeek()'s mode argument, whose Monday-vs-Sunday values are not
 * worth getting wrong silently) exactly like every other weekly chart in this
 * app already does for the same reason: an empty week must read as zero, not
 * fall out of the axis.
 */
export async function visitorTrend(
  weeks = 12,
  now: Date = new Date(),
): Promise<VisitorTrend | null> {
  const rows = await hogql(`
    SELECT toMonday(timestamp) AS week, count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${weeks * 2} WEEK
    GROUP BY week
    ORDER BY week
  `);
  if (rows === null) return null;

  const byWeek = new Map(
    rows.map((row) => [String(row[0]).slice(0, 10), Number(row[1])]),
  );

  const totalWeeks = weeks * 2;
  const thisWeek = weekStartOf(now);
  const from = new Date(thisWeek);
  from.setUTCDate(from.getUTCDate() - (totalWeeks - 1) * 7);

  const all: VisitorWeek[] = [];
  for (let i = 0; i < totalWeeks; i += 1) {
    const start = new Date(from);
    start.setUTCDate(start.getUTCDate() + i * 7);
    const key = dayKey(start);
    all.push({
      weekStart: key,
      label: WEEK_LABEL.format(start),
      visitors: byWeek.get(key) ?? 0,
    });
  }

  const current = all.slice(weeks);
  const previous = all.slice(0, weeks);
  const sum = (arr: VisitorWeek[]) =>
    arr.reduce((total, week) => total + week.visitors, 0);

  const totalCurrent = sum(current);
  const totalPrevious = sum(previous);

  return {
    current,
    previous,
    totalCurrent,
    totalPrevious,
    changePercent: change(totalCurrent, totalPrevious),
  };
}

export type CheckoutFunnel = { started: number; completed: number };

/**
 * How many gyms started a Stripe Checkout versus actually completed one, the
 * last `weeks` weeks. Both events are captured server-side keyed on gym.id
 * (see checkout/route.ts and stripe/webhook/route.ts), so — unlike a website
 * visitor, who is anonymous — this pair genuinely is the same gym on both
 * rows, not two numbers assumed to relate.
 */
export async function checkoutFunnel(weeks = 12): Promise<CheckoutFunnel | null> {
  const rows = await hogql(`
    SELECT event, count(DISTINCT distinct_id) AS gyms
    FROM events
    WHERE event IN ('checkout_started', 'checkout_completed')
      AND timestamp >= now() - INTERVAL ${weeks} WEEK
    GROUP BY event
  `);
  if (rows === null) return null;

  const funnel: CheckoutFunnel = { started: 0, completed: 0 };
  for (const [event, count] of rows) {
    if (event === "checkout_started") funnel.started = Number(count);
    if (event === "checkout_completed") funnel.completed = Number(count);
  }
  return funnel;
}
