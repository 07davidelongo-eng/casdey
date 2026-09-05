"use client";

import { useId, useState } from "react";
import { SAMPLE_LIST, WINDOW_MONTHS, type SampleMember } from "@/lib/sample-list";

/**
 * The hero's one object: a gym's member list, sorted by time since last visit.
 *
 * Each row is the signature from the brand guide, one member's history as a
 * line. Stacked and sorted, the boundary between the visits and the silence
 * traces the tail, so the shape IS the argument and no chart is needed to
 * explain it.
 *
 * The scrubber is the product's actual first question, "how long is long
 * enough to count as lapsed", made draggable. Everything left of the gold
 * rule is in scope. That is the whole of casdey's find step, and a visitor
 * can answer it for themselves before signing up for anything.
 *
 * Two geometries are rendered rather than one resized, because a 52-row wall
 * scaled to a phone is a grey texture. The wide one is hidden below md, the
 * narrow one above it, and both read the same state.
 */

type Geometry = {
  rows: SampleMember[];
  width: number;
  height: number;
  x0: number;
  x1: number;
  top: number;
  gap: number;
  dot: number;
};

const WIDE: Geometry = {
  rows: SAMPLE_LIST,
  width: 1200,
  height: 610,
  x0: 44,
  x1: 1152,
  top: 18,
  gap: 11,
  dot: 3.4,
};

const NARROW: Geometry = {
  rows: SAMPLE_LIST,
  width: 560,
  height: 512,
  x0: 22,
  x1: 536,
  top: 16,
  gap: 9,
  dot: 3.6,
};

function Wall({
  geo,
  months,
  maskId,
}: {
  geo: Geometry;
  months: number;
  maskId: string;
}) {
  const span = geo.x1 - geo.x0;
  const xFor = (m: number) => geo.x0 + (m / WINDOW_MONTHS) * span;
  const ruleX = xFor(WINDOW_MONTHS - months);

  return (
    <svg
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      className="w-full"
      role="img"
      aria-label={`A sample gym list of ${geo.rows.length} members, one row each, sorted by time since their last visit.`}
    >
      <defs>
        <mask id={maskId}>
          <rect
            className="wall-wipe"
            x="0"
            y="0"
            width={geo.width}
            height={geo.height}
            fill="#fff"
          />
        </mask>
      </defs>

      {/* Today. Every row's silence runs out here, so it is the one rule the
          wall is measured against. */}
      <line
        x1={geo.x1}
        y1={geo.top - 10}
        x2={geo.x1}
        y2={geo.top + geo.rows.length * geo.gap}
        stroke="var(--ash)"
        strokeWidth="1"
      />

      {/* The cut. Everything left of it has been quiet for long enough. */}
      <line
        className="wall-rule"
        x1={ruleX}
        y1={geo.top - 10}
        x2={ruleX}
        y2={geo.top + geo.rows.length * geo.gap}
        stroke="var(--teal)"
        strokeWidth="1.5"
      />

      <g mask={`url(#${maskId})`}>
        {geo.rows.map((row, i) => {
          const y = geo.top + i * geo.gap;
          const lastVisit = WINDOW_MONTHS - row.silence;
          const inScope = row.silence >= months;
          const dots = row.visits
            .map((v) => `M${xFor(v).toFixed(1)} ${y}h0`)
            .join("");

          return (
            <g key={i} className={inScope ? "wall-row is-scope" : "wall-row"}>
              {/* The run they were attending. The dots alone read as a scatter
                  plot; on a rule they read as one member's history, and the
                  step from rule to dash is what traces the tail. */}
              <line
                className="wall-run"
                x1={xFor(row.joined)}
                y1={y}
                x2={xFor(lastVisit)}
                y2={y}
                strokeWidth="1"
              />
              <path
                className="wall-dots"
                d={dots}
                strokeWidth={geo.dot}
                strokeLinecap="round"
                fill="none"
              />
              {row.silence > 0 && (
                <line
                  className="wall-gap"
                  x1={xFor(lastVisit) + geo.dot}
                  y1={y}
                  x2={geo.x1 - 2}
                  y2={y}
                  strokeWidth="1.4"
                  strokeDasharray="1.5 6"
                  strokeLinecap="round"
                />
              )}
              {row.returned && (
                <circle
                  className="wall-return"
                  cx={geo.x1}
                  cy={y}
                  r={geo.dot * 0.95}
                  fill="var(--amber)"
                  style={{ animationDelay: `${1.25 + i * 0.02}s` }}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function MemberWall() {
  const [months, setMonths] = useState(6);
  const wideMask = useId();
  const narrowMask = useId();

  const quiet = SAMPLE_LIST.filter((row) => row.silence >= months).length;
  const returned = SAMPLE_LIST.filter((row) => row.returned).length;

  return (
    <figure className="m-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <figcaption className="label text-stone">
          a sample list · illustrative
        </figcaption>
        <p className="label text-stone">
          <span className="text-teal">{returned} returned</span> · today &rarr;
        </p>
      </div>

      <div className="mt-3">
        <div className="hidden md:block">
          <Wall geo={WIDE} months={months} maskId={wideMask} />
        </div>
        <div className="md:hidden">
          <Wall geo={NARROW} months={months} maskId={narrowMask} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 border-t border-ash pt-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10">
        <p className="text-ink">
          <span className="display block text-[2.75rem] leading-none tabular-nums">
            {quiet}
            <span className="text-stone">/{SAMPLE_LIST.length}</span>
          </span>
          <span className="mt-2 block text-[0.9375rem] text-graphite">
            members not seen for {months} {months === 1 ? "month" : "months"} or
            more
          </span>
        </p>

        <label className="block">
          <span className="label mb-3 block text-stone">
            drag to set how long counts as lapsed
          </span>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={months}
            onChange={(event) => setMonths(Number(event.target.value))}
            className="wall-range w-full"
            aria-label="Months since last visit"
          />
        </label>
      </div>
    </figure>
  );
}
