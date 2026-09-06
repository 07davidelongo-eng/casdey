/**
 * One measure, twelve weeks, as bars.
 *
 * Three small charts of one series each rather than one chart of three: sent,
 * returned and revenue are different units on wildly different scales, and
 * putting them together would mean either a second y-axis, which is the single
 * worst thing a chart can have, or two of the three squashed flat against the
 * baseline. Small multiples say the same thing and stay readable.
 *
 * A single series needs no legend: the title names it. Bars carry a <title>
 * so hovering any week gives the exact figure, which is what a tooltip is for
 * and is one line rather than a hover state machine.
 *
 * Server-rendered SVG, no chart library. The whole thing is twelve rectangles
 * and it re-themes for dark mode on its own because every colour is a token.
 */

export function TrendChart({
  title,
  hero,
  caption,
  points,
  tone = "teal",
}: {
  title: string;
  /** The headline figure for the period, already formatted. */
  hero: string;
  caption: string;
  points: { label: string; value: number; display: string }[];
  tone?: "teal" | "amber" | "returned";
}) {
  const max = Math.max(...points.map((p) => p.value), 0);
  const width = 100;
  const height = 34;
  const gap = 1.6;
  const barWidth = (width - gap * (points.length - 1)) / points.length;

  const fill =
    tone === "amber"
      ? "var(--amber)"
      : tone === "returned"
        ? "color-mix(in srgb, var(--teal) 60%, var(--amber))"
        : "var(--teal)";

  return (
    <div className="rounded-[14px] border border-ash bg-white p-5">
      <p className="label text-stone">{title}</p>
      <p className="literal mt-1 text-[1.75rem] leading-none font-medium text-ink">
        {hero}
      </p>

      {max === 0 ? (
        <p className="mt-4 text-[0.8125rem] text-stone">
          Nothing yet in the last twelve weeks.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}, by week, for the last ${points.length} weeks`}
          className="mt-4 block h-[68px] w-full overflow-visible"
          preserveAspectRatio="none"
        >
          {points.map((point, index) => {
            // Every week gets a mark, including the empty ones: a missing bar
            // reads as missing data, a flat one reads as a quiet week.
            const barHeight = max === 0 ? 0 : (point.value / max) * height;
            const drawn = Math.max(barHeight, point.value > 0 ? 1.5 : 0.6);
            return (
              <rect
                key={point.label}
                x={index * (barWidth + gap)}
                y={height - drawn}
                width={barWidth}
                height={drawn}
                rx={0.8}
                fill={point.value > 0 ? fill : "var(--ash)"}
              >
                <title>
                  {point.label}: {point.display}
                </title>
              </rect>
            );
          })}
        </svg>
      )}

      <div className="mt-2 flex justify-between text-[0.6875rem] text-stone">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-stone">
        {caption}
      </p>
    </div>
  );
}
