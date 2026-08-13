/**
 * The brand's signature element, made real.
 *
 * The guide draws one patient's history as a line: a couple of visits, a long
 * dashed gap, and an amber ring at the moment they book again. That drawing is
 * the whole product in one picture, and it is the only place amber is allowed
 * to appear.
 *
 * Here it is driven by an actual patient's actual numbers rather than being an
 * illustration of one. Nothing on it is invented: if there is no rebooking, the
 * amber ring is simply absent.
 */
export function PatientTimeline({
  visitCount,
  monthsAway,
  rebooked = false,
  className = "",
}: {
  visitCount: number;
  monthsAway: number | null;
  rebooked?: boolean;
  className?: string;
}) {
  // Two dots reads as "a couple of visits" at this size. More than four and
  // they stop being countable, which defeats the point of drawing them.
  const dots = Math.min(Math.max(visitCount, 1), 4);
  const spacing = 26;
  const startX = 14;
  const lastVisitX = startX + (dots - 1) * spacing;
  const endX = 300;
  const y = 30;

  const gapLabel =
    monthsAway === null
      ? "no visit on record"
      : monthsAway === 1
        ? "no contact for 1 month"
        : `no contact for ${monthsAway} months`;

  const visitLabel = visitCount === 1 ? "1 visit" : `${visitCount} visits`;

  return (
    <svg
      viewBox="0 0 340 62"
      className={`h-[62px] w-full max-w-[340px] ${className}`}
      role="img"
      aria-label={`${visitLabel}, then ${gapLabel}${rebooked ? ", then rebooked" : ""}`}
    >
      {/* The visits: solid, teal, close together. */}
      {dots > 1 ? (
        <line
          x1={startX}
          y1={y}
          x2={lastVisitX}
          y2={y}
          stroke="var(--teal)"
          strokeWidth="2"
        />
      ) : null}

      {/* The silence: dashed, ash, long. */}
      <line
        x1={lastVisitX}
        y1={y}
        x2={rebooked ? endX - 13 : endX}
        y2={y}
        stroke="var(--ash)"
        strokeWidth="2"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />

      {Array.from({ length: dots }).map((_, index) => (
        <circle
          key={index}
          cx={startX + index * spacing}
          cy={y}
          r="4"
          fill="var(--teal)"
        />
      ))}

      {rebooked ? (
        <>
          <circle
            cx={endX}
            cy={y}
            r="11"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="1.5"
          />
          <circle cx={endX} cy={y} r="4" fill="var(--teal)" />
        </>
      ) : null}

      <text
        x={startX}
        y={y - 12}
        fill="var(--stone)"
        fontSize="10"
        fontFamily="var(--font-jetbrains-mono), ui-monospace, monospace"
      >
        {visitLabel}
      </text>

      <text
        x={lastVisitX + 10}
        y={y + 21}
        fill="var(--stone)"
        fontSize="10"
        fontFamily="var(--font-jetbrains-mono), ui-monospace, monospace"
      >
        {gapLabel}
      </text>

      {rebooked ? (
        <text
          x={endX}
          y={y - 17}
          fill="var(--graphite)"
          fontSize="10"
          fontWeight="500"
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), ui-monospace, monospace"
        >
          rebooked
        </text>
      ) : null}
    </svg>
  );
}
