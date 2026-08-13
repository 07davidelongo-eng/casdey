/**
 * A patient list sorted by time since last visit. The long tail on the right is
 * the part casdey works.
 *
 * This is a diagram, not a measurement. The shape is illustrative and labelled
 * as such: casdey has no practice data to chart yet, and inventing some would
 * be a lie dressed as evidence.
 */

const BARS = [
  { h: 96, dormant: false },
  { h: 82, dormant: false },
  { h: 71, dormant: false },
  { h: 60, dormant: false },
  { h: 52, dormant: false },
  { h: 46, dormant: false },
  { h: 41, dormant: true },
  { h: 37, dormant: true },
  { h: 34, dormant: true },
  { h: 31, dormant: true },
  { h: 29, dormant: true },
  { h: 27, dormant: true },
  { h: 25, dormant: true },
  { h: 23, dormant: true },
];

const BASELINE = 150;
const BAR_W = 18;
const GAP = 8;
const START_X = 14;

export function DormantChart({ className = "" }: { className?: string }) {
  const firstDormant = BARS.findIndex((b) => b.dormant);
  const bracketStart = START_X + firstDormant * (BAR_W + GAP);
  const bracketEnd = START_X + BARS.length * (BAR_W + GAP) - GAP;

  return (
    <svg
      viewBox="0 0 380 186"
      role="img"
      aria-label="A patient list sorted by time since last visit. Most recent visits sit on the left, and a long tail of patients last seen over a year ago sits on the right. That tail is what casdey works."
      className={`w-full ${className}`}
    >
      {BARS.map((bar, i) => {
        const x = START_X + i * (BAR_W + GAP);
        return (
          <rect
            key={i}
            x={x}
            y={BASELINE - bar.h}
            width={BAR_W}
            height={bar.h}
            rx="3"
            className={bar.dormant ? "fill-teal" : "fill-ash"}
          />
        );
      })}

      <line
        x1="8"
        y1={BASELINE + 0.5}
        x2="372"
        y2={BASELINE + 0.5}
        className="stroke-ash"
        strokeWidth="1"
      />

      {/* Bracket over the reachable tail */}
      <path
        d={`M${bracketStart} 30 v-6 h${bracketEnd - bracketStart} v6`}
        fill="none"
        className="stroke-teal"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={(bracketStart + bracketEnd) / 2}
        y="16"
        textAnchor="middle"
        className="fill-teal"
        style={{
          font: '500 10px var(--font-jetbrains-mono), ui-monospace, monospace',
          letterSpacing: "0.08em",
        }}
      >
        CASDEY WORKS THIS
      </text>

      <text
        x="8"
        y={BASELINE + 18}
        className="fill-stone"
        style={{
          font: '400 10px var(--font-jetbrains-mono), ui-monospace, monospace',
        }}
      >
        seen recently
      </text>
      <text
        x="372"
        y={BASELINE + 18}
        textAnchor="end"
        className="fill-stone"
        style={{
          font: '400 10px var(--font-jetbrains-mono), ui-monospace, monospace',
        }}
      >
        24 months+
      </text>
      <text
        x="8"
        y={BASELINE + 34}
        className="fill-stone"
        style={{
          font: '400 9px var(--font-jetbrains-mono), ui-monospace, monospace',
        }}
      >
        illustrative shape, not your data
      </text>
    </svg>
  );
}
