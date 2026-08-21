/**
 * The signature device.
 *
 * One member's history as a line: two visits close together, then a long
 * dashed nothing, then a booking. It is the product in one picture, and the
 * only place the warm accent is allowed to appear.
 */
export function MemberTimeline({
  className = "",
  gapLabel = "no contact for 17 months",
  endLabel = "returned",
}: {
  className?: string;
  gapLabel?: string;
  endLabel?: string;
}) {
  return (
    <svg
      viewBox="0 0 340 78"
      role="img"
      aria-label={`Two early visits, then ${gapLabel}, then ${endLabel}.`}
      className={`w-full ${className}`}
    >
      {/* The visits the gym already had */}
      <line
        x1="20"
        y1="44"
        x2="54"
        y2="44"
        className="stroke-teal"
        strokeWidth="2"
      />
      <circle cx="20" cy="44" r="5" className="fill-teal" />
      <circle cx="54" cy="44" r="5" className="fill-teal" />

      {/* The gap nobody works */}
      <line
        x1="64"
        y1="44"
        x2="262"
        y2="44"
        className="stroke-ash"
        strokeWidth="2"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />
      <text
        x="163"
        y="26"
        textAnchor="middle"
        className="fill-stone"
        style={{
          font: '400 10px var(--font-jetbrains-mono), ui-monospace, monospace',
          letterSpacing: "0.06em",
        }}
      >
        {gapLabel}
      </text>

      {/* The booking that closes it */}
      <circle
        cx="284"
        cy="44"
        r="11"
        fill="none"
        className="stroke-amber"
        strokeWidth="1.5"
      />
      <circle cx="284" cy="44" r="5.5" className="fill-teal" />

      <text
        x="37"
        y="68"
        textAnchor="middle"
        className="fill-stone"
        style={{
          font: '400 10px var(--font-jetbrains-mono), ui-monospace, monospace',
        }}
      >
        2 visits
      </text>
      <text
        x="284"
        y="68"
        textAnchor="middle"
        className="fill-graphite"
        style={{
          font: '500 10px var(--font-jetbrains-mono), ui-monospace, monospace',
        }}
      >
        {endLabel}
      </text>
    </svg>
  );
}
