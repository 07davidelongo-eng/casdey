/**
 * The dashboard's charts.
 *
 * Server-rendered SVG, no chart library, every colour a token so dark mode
 * needs no second implementation. Three shapes, each doing one job:
 *
 *   MetricChart  a measure over twelve weeks, with the headline and how it
 *                compares to the twelve before it
 *   Funnel       lapsed to contacted to returned, on one shared scale
 *   Split        one bar cut into parts that add up to a whole
 *
 * What is deliberately absent: any chart with two y-axes. Messages sent and
 * members returned differ by an order of magnitude, and drawing them together
 * against two scales lets a chart imply a relationship the data has not
 * earned. They get their own panels instead.
 */

const TONES = {
  teal: "var(--teal)",
  amber: "var(--amber)",
  returned: "color-mix(in srgb, var(--teal) 55%, var(--amber))",
} as const;

type Tone = keyof typeof TONES;

export function MetricChart({
  title,
  hero,
  points,
  changePercent,
  changeLabel,
  tone = "teal",
  caption,
}: {
  title: string;
  hero: string;
  points: { label: string; value: number; display: string }[];
  /** Null when there is no previous period worth comparing against. */
  changePercent: number | null;
  changeLabel: string;
  tone?: Tone;
  caption?: string;
}) {
  const max = Math.max(...points.map((p) => p.value), 0);
  const width = 320;
  const height = 96;
  const gap = 3;
  const barWidth = (width - gap * (points.length - 1)) / points.length;
  const fill = TONES[tone];

  return (
    <div className="rounded-[16px] border border-ash bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-stone">{title}</p>
        {changePercent !== null ? (
          <span
            className={`literal text-[0.8125rem] font-medium ${
              changePercent >= 0 ? "text-teal" : "text-stone"
            }`}
          >
            {changePercent >= 0 ? "+" : ""}
            {changePercent}%
          </span>
        ) : null}
      </div>

      <p className="literal mt-1 text-[2rem] leading-none font-medium text-ink">
        {hero}
      </p>
      <p className="mt-1 text-[0.75rem] text-stone">{changeLabel}</p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} by week, last ${points.length} weeks`}
        className="mt-4 block h-[96px] w-full"
        preserveAspectRatio="none"
      >
        {/* Three recessive gridlines. Enough to read a height off, not enough
            to compete with the bars. */}
        {[0.25, 0.5, 0.75].map((step) => (
          <line
            key={step}
            x1={0}
            x2={width}
            y1={height * step}
            y2={height * step}
            stroke="var(--ash)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {points.map((point, index) => {
          const barHeight = max === 0 ? 0 : (point.value / max) * (height - 4);
          // An empty week keeps a hairline so the axis reads as continuous:
          // a missing bar looks like missing data, a flat one looks like a
          // quiet week, and they are not the same thing.
          const drawn = point.value > 0 ? Math.max(barHeight, 3) : 1.5;
          return (
            <rect
              key={point.label}
              x={index * (barWidth + gap)}
              y={height - drawn}
              width={barWidth}
              height={drawn}
              rx={2}
              fill={point.value > 0 ? fill : "var(--ash)"}
            >
              {/* One text child, not two. React hoists <title> and cannot
                  hydrate a pair of text nodes inside it, which is what was
                  failing hydration on the whole dashboard. */}
              <title>{`${point.label}: ${point.display}`}</title>
            </rect>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between text-[0.6875rem] text-stone">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>

      {caption ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-stone">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Lapsed, contacted, returned: the whole product in three bars.
 *
 * Horizontal, on one shared scale, so the drop between stages is the length of
 * the bar rather than something the reader has to work out from two numbers.
 * The percentage is always of the first stage, never of the one above, because
 * "20% of the people we wrote to" and "20% of everyone who went quiet" are
 * different claims and only one of them is what the gym cares about.
 */
export function Funnel({
  stages,
}: {
  stages: { label: string; value: number; hint: string; tone: Tone }[];
}) {
  const top = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <ul className="space-y-4">
      {stages.map((stage) => {
        const share = Math.round((stage.value / top) * 100);
        return (
          <li key={stage.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[0.9375rem] text-ink">{stage.label}</span>
              <span className="literal text-[0.9375rem] font-medium text-ink">
                {stage.value}
                {stage.value > 0 && share < 100 ? (
                  <span className="ml-2 text-[0.8125rem] font-normal text-stone">
                    {share}%
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-mist">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(share, stage.value > 0 ? 2 : 0)}%`,
                  background: TONES[stage.tone],
                }}
              />
            </div>
            <p className="mt-1 text-[0.8125rem] text-stone">{stage.hint}</p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One bar cut into parts that add up to a whole, with a real legend.
 *
 * A stacked bar rather than a pie: comparing angles is harder than comparing
 * lengths, and four statuses in a ring would need four labels around it to be
 * readable at all. Segments carry a 2px gap so two similar tones never touch.
 */
export function Split({
  parts,
  total,
}: {
  parts: { label: string; value: number; tone: Tone | "quiet" }[];
  total: number;
}) {
  const shown = parts.filter((part) => part.value > 0);

  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-mist">
        {shown.map((part) => (
          <div
            key={part.label}
            title={`${part.label}: ${part.value}`}
            style={{
              width: `${(part.value / Math.max(total, 1)) * 100}%`,
              background:
                part.tone === "quiet" ? "var(--ash)" : TONES[part.tone],
            }}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {parts.map((part) => (
          <li
            key={part.label}
            className="flex items-center gap-2.5 text-[0.875rem]"
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                background:
                  part.tone === "quiet" ? "var(--ash)" : TONES[part.tone],
              }}
            />
            <span className="flex-1 text-graphite">{part.label}</span>
            <span className="literal font-medium text-ink">{part.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A measure over time as a line, with the period before it behind it.
 *
 * The comparison line is the point of the whole chart. A single line tells a
 * gym what happened; two tell it whether that is better than last time, which
 * is the only version of the question anybody actually asks. It is the pattern
 * every analytics dashboard worth copying uses, Shopify's included.
 *
 * The two series share one y-axis, and they can because they are the same
 * measure over two equal stretches of time. That is the only circumstance in
 * which two lines belong on one chart: same unit, same scale, no second axis.
 *
 * Drawn as an area plus a line rather than bars because twelve weeks is a
 * trend, and a trend is a shape. Points carry a <title> each, so any week can
 * be read exactly by hovering it.
 */
export function LineChart({
  title,
  hero,
  changePercent,
  points,
  comparison,
  tone = "amber",
  caption,
}: {
  title: string;
  hero: string;
  changePercent: number | null;
  points: { label: string; value: number; display: string }[];
  /** The same measure, the period before. Same length, same scale. */
  comparison: { value: number }[];
  tone?: Tone;
  caption?: string;
}) {
  const width = 600;
  const height = 200;
  const padTop = 16;
  const padBottom = 28;
  const padLeft = 8;
  const padRight = 8;

  // One scale for both lines. Taking the max across the pair is what makes the
  // comparison honest: scaling each to its own maximum would draw two flat
  // lines and hide the difference the chart exists to show.
  const max = Math.max(
    ...points.map((p) => p.value),
    ...comparison.map((p) => p.value),
    1,
  );

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const x = (index: number) => padLeft + index * step;
  const y = (value: number) => padTop + plotHeight - (value / max) * plotHeight;

  const path = (series: { value: number }[]) =>
    series
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(point.value)}`)
      .join(" ");

  const area = `${path(points)} L${x(points.length - 1)} ${padTop + plotHeight} L${x(0)} ${padTop + plotHeight} Z`;
  const fill = TONES[tone];
  const gradientId = `fade-${title.replace(/\W+/g, "")}`;

  return (
    <div className="rounded-[16px] border border-ash bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="label text-stone">{title}</p>
          <p className="literal mt-1 text-[1.75rem] leading-none font-medium text-ink">
            {hero}
          </p>
        </div>
        {changePercent !== null ? (
          <span
            className={`literal text-[0.875rem] font-medium ${
              changePercent >= 0 ? "text-teal" : "text-stone"
            }`}
          >
            {changePercent >= 0 ? "+" : ""}
            {changePercent}% on the twelve before
          </span>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} over the last ${points.length} weeks, against the ${comparison.length} weeks before`}
        className="mt-4 block h-[200px] w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.22" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((stop) => (
          <line
            key={stop}
            x1={padLeft}
            x2={width - padRight}
            y1={padTop + plotHeight * stop}
            y2={padTop + plotHeight * stop}
            stroke="var(--ash)"
            strokeWidth={1}
          />
        ))}

        {/* Behind, dashed and quiet: it is context, not the subject. */}
        <path
          d={path(comparison)}
          fill="none"
          stroke="var(--stone)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.7}
        />

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={path(points)}
          fill="none"
          stroke={fill}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, index) => (
          <circle
            key={point.label}
            cx={x(index)}
            cy={y(point.value)}
            r={index === points.length - 1 ? 4 : 3}
            fill={index === points.length - 1 ? fill : "var(--white)"}
            stroke={fill}
            strokeWidth={1.5}
          >
            <title>{`${point.label}: ${point.display}`}</title>
          </circle>
        ))}

        <text
          x={padLeft}
          y={height - 8}
          className="literal"
          fontSize="11"
          fill="var(--stone)"
        >
          {points[0]?.label}
        </text>
        <text
          x={width - padRight}
          y={height - 8}
          textAnchor="end"
          className="literal"
          fontSize="11"
          fill="var(--stone)"
        >
          {points.at(-1)?.label}
        </text>
      </svg>

      {/* Two series, so a legend is not optional. */}
      <div className="mt-3 flex flex-wrap items-center gap-5 text-[0.8125rem] text-stone">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0.5 w-5 rounded-full"
            style={{ background: fill }}
          />
          Last twelve weeks
        </span>
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0.5 w-5 rounded-full opacity-70"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, var(--stone) 0 4px, transparent 4px 8px)",
            }}
          />
          The twelve before
        </span>
      </div>

      {caption ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-stone">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
