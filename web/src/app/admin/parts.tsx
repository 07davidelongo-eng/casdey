import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardTitle } from "@/components/app/ui";
import type { RankedRow } from "@/lib/posthog-query";

/**
 * Presentational bits used only by /admin. The charts (LineChart, Funnel,
 * Split, MetricChart) are shared with a gym's own dashboard and live in
 * components/app/chart.tsx; these three are founder-view-only, so they sit
 * next to the page instead.
 */

/* ------------------------------------------------------------------ */
/* Period selector                                                    */
/* ------------------------------------------------------------------ */

/**
 * A reporting window, held as a whole number of days back from now (the
 * comparison is always the same length again, immediately before it).
 *
 *   - `days` drives every date-bounded query in admin-stats / posthog-query.
 *   - `bucket` is how the trend charts group their points: by day for short
 *     windows (≤ 21 days), by week beyond that — a daily chart of a year is
 *     365 hair-thin bars, a weekly chart of a fortnight is two.
 *   - `label` is the noun phrase ("30 days", "twelve weeks", "3 months") for
 *     "Last …" captions; `sentence` is the full comparison line.
 */
export type PeriodBucket = "day" | "week";

export type AdminPeriod = {
  days: number;
  bucket: PeriodBucket;
  short: string;
  label: string;
  sentence: string;
};

/** ~2 years. Past this the "vs the period before" comparison reaches back
 *  further than casdey has existed, and the PostHog scan (INTERVAL days*2
 *  DAY) stops being cheap. */
export const MAX_PERIOD_DAYS = 730;

type Unit = "d" | "w" | "m";
const UNIT_DAYS: Record<Unit, number> = { d: 1, w: 7, m: 30 };
const UNIT_NAME: Record<Unit, string> = { d: "days", w: "weeks", m: "months" };

const PRESETS: { param: string; short: string; days: number }[] = [
  { param: "today", short: "Today", days: 1 },
  { param: "7d", short: "7d", days: 7 },
  { param: "30d", short: "30d", days: 30 },
  { param: "12w", short: "12w", days: 84 },
  { param: "6m", short: "6m", days: 180 },
  { param: "1y", short: "1y", days: 365 },
];
/** The one the bare /admin URL means. */
const DEFAULT_PARAM = "12w";

function bucketFor(days: number): PeriodBucket {
  return days <= 21 ? "day" : "week";
}

function labelForDays(days: number): string {
  if (days === 1) return "24 hours";
  if (days % 365 === 0) {
    const y = days / 365;
    return y === 1 ? "year" : `${y} years`;
  }
  if (days % 30 === 0 && days / 30 >= 2) return `${days / 30} months`;
  if (days % 7 === 0) {
    const w = days / 7;
    return w === 1 ? "week" : `${w} weeks`;
  }
  return `${days} days`;
}

function makePeriod(days: number, short: string): AdminPeriod {
  const clamped = Math.min(Math.max(Math.round(days), 1), MAX_PERIOD_DAYS);
  const label = labelForDays(clamped);
  return {
    days: clamped,
    bucket: bucketFor(clamped),
    short,
    label,
    sentence:
      clamped === 1
        ? "Today so far, against the same window yesterday."
        : `The last ${label}, against the ${label} before.`,
  };
}

/**
 * Resolve the URL into a period. Accepts, in order of precedence:
 *   - a preset key: today | 7d | 30d | 12w | 6m | 1y
 *   - `range=<n><unit>` where unit is d/w/m (e.g. 45d, 3m, 8w)
 *   - `count=<n>` + `unit=<d|w|m>` (what the custom form submits)
 *   - a bare `range=<n>` — legacy, read as weeks
 * Anything unparseable falls back to the 12-week default.
 */
export function periodFrom(params: {
  range?: string;
  count?: string;
  unit?: string;
}): AdminPeriod {
  const { range, count, unit } = params;

  const preset = PRESETS.find((p) => p.param === range);
  if (preset) return makePeriod(preset.days, preset.short);

  const combined =
    range ??
    (count && unit ? `${count}${unit}` : count ? `${count}w` : undefined);

  if (combined) {
    const m = /^(\d{1,4})\s*(d|w|m)?$/i.exec(combined.trim());
    if (m) {
      const n = Number(m[1]);
      const u = (m[2]?.toLowerCase() as Unit | undefined) ?? "w";
      if (n >= 1) return makePeriod(n * UNIT_DAYS[u], `${n}${u}`);
    }
  }

  return makePeriod(84, "12w");
}

/** Best-fit {count, unit} for showing a period back in the custom form. */
function asCustom(period: AdminPeriod): { count: number; unit: Unit } {
  if (period.days % 30 === 0 && period.days >= 30) {
    return { count: period.days / 30, unit: "m" };
  }
  if (period.days % 7 === 0) return { count: period.days / 7, unit: "w" };
  return { count: period.days, unit: "d" };
}

/**
 * The presets are links (each period is a URL, so it can be linked to and
 * survives a reload) and the custom control is a plain GET form to the same
 * URL, so the whole thing needs no client JS and the page stays one server
 * render. Mirrors the per-gym dashboard's own period nav, plus a free
 * "last N days / weeks / months" box.
 */
export function PeriodNav({ current }: { current: AdminPeriod }) {
  const activeParam =
    PRESETS.find((p) => p.days === current.days)?.param ??
    (current.days === 84 ? DEFAULT_PARAM : null);
  const onPreset = activeParam !== null;
  const custom = asCustom(current);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Reporting period" className="flex flex-wrap gap-1">
        {PRESETS.map((option) => {
          const active = option.param === activeParam;
          return (
            <Link
              key={option.param}
              href={
                option.param === DEFAULT_PARAM
                  ? "/admin"
                  : `/admin?range=${option.param}`
              }
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150 ${
                active
                  ? "border-teal bg-shallow text-teal"
                  : "border-ash text-graphite hover:border-stone hover:text-ink"
              }`}
            >
              {option.short}
            </Link>
          );
        })}
      </nav>

      <form action="/admin" method="get" className="flex items-center gap-1">
        <label htmlFor="admin-count" className="text-[0.8125rem] text-stone">
          or last
        </label>
        <input
          id="admin-count"
          name="count"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_PERIOD_DAYS}
          defaultValue={onPreset ? "" : custom.count}
          placeholder={onPreset ? "N" : undefined}
          aria-label="Custom reporting period"
          className={`w-16 rounded-md border px-2 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150 ${
            onPreset
              ? "border-ash text-graphite"
              : "border-teal bg-shallow text-teal"
          }`}
        />
        <label htmlFor="admin-unit" className="sr-only">
          Unit
        </label>
        <select
          id="admin-unit"
          name="unit"
          defaultValue={onPreset ? "d" : custom.unit}
          className="rounded-md border border-ash bg-white px-2 py-1.5 text-[0.8125rem] font-medium text-graphite"
        >
          {(Object.keys(UNIT_NAME) as Unit[]).map((u) => (
            <option key={u} value={u}>
              {UNIT_NAME[u]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-ash px-2.5 py-1.5 text-[0.8125rem] font-medium text-graphite transition-colors duration-150 hover:border-stone hover:text-ink"
        >
          Go
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper                                                    */
/* ------------------------------------------------------------------ */

export function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-ash pt-8 first:mt-0 first:border-0 first:pt-0">
      <div className="mb-4">
        <h2 className="display text-[1.25rem]">{title}</h2>
        {sub ? <p className="text-[0.875rem] text-stone">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked list (top pages / referrers / countries / …)                */
/* ------------------------------------------------------------------ */

export function RankedList({
  title,
  rows,
  empty,
  unit,
}: {
  title: string;
  /** null means the data source (PostHog) is not connected or failed. */
  rows: RankedRow[] | null;
  empty: string;
  unit?: string;
}) {
  const max = rows && rows.length > 0 ? Math.max(...rows.map((r) => r.value)) : 1;

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {rows === null ? (
        <p className="mt-2 text-[0.8125rem] text-stone">
          PostHog not connected.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-[0.8125rem] text-stone">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3 text-[0.875rem]">
                <span className="min-w-0 truncate text-graphite" title={row.label}>
                  {row.label}
                </span>
                <span className="literal shrink-0 font-medium text-ink">
                  {row.value.toLocaleString("en-GB")}
                  {unit ? (
                    <span className="text-stone">
                      {" "}
                      {row.value === 1 ? unit.replace(/s$/, "") : unit}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-mist">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((row.value / max) * 100, 2)}%`,
                    background: "var(--teal)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
