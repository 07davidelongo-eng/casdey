"use client";

import { useEffect, useRef } from "react";

/**
 * One member, drawn along the scroll.
 *
 * The section this replaces was three numbered cards, which is the layout
 * every process section on every B2B site uses and which makes three
 * unrelated boxes out of something that is really one sequence in time.
 * Here the sequence is the drawing: visits, then the silence, then the
 * message casdey sends into it, then the reply that ends it, then visits
 * again. The steps are labels along a line rather than cards in a row,
 * because here the order carries information the reader needs.
 *
 * Progress is written to a CSS custom property on the wrapper rather than to
 * React state, so scrolling does not re-render the section every frame.
 * Everything downstream is CSS reading --p.
 *
 * --p defaults to 1 in the stylesheet, so with JavaScript off, or with
 * reduced motion asked for, the section is simply already drawn.
 */

type Line = {
  w: number;
  h: number;
  y: number;
  run: [number, number];
  dots: number[];
  gap: [number, number];
  msg: number;
  reply: number;
  back: [number, number];
  backDots: number[];
  dot: number;
};

/* Two geometries rather than one scaled down: at 375px a 1200-unit line
   draws its visits at two pixels and the whole point disappears. */
const WIDE: Line = {
  w: 1200,
  h: 104,
  y: 56,
  run: [40, 200],
  dots: [48, 76, 104, 132, 160, 188],
  gap: [212, 988],
  msg: 600,
  reply: 1000,
  back: [1012, 1160],
  backDots: [1040, 1068, 1096, 1124, 1152],
  dot: 7,
};

const NARROW: Line = {
  w: 440,
  h: 92,
  y: 50,
  run: [10, 82],
  dots: [14, 31, 48, 65, 82],
  gap: [92, 352],
  msg: 220,
  reply: 366,
  back: [378, 432],
  backDots: [386, 404, 422],
  dot: 6,
};

const BEATS = [
  {
    at: 0.16,
    eyebrow: "your list",
    title: "You bring in your list",
    body: "A file from your gym software, or a CSV. casdey reads the visit history and works out who drifted, who is still turning up, and what the quiet part is worth.",
  },
  {
    at: 0.42,
    eyebrow: "casdey",
    title: "casdey writes as your gym",
    body: "It picks the members worth contacting and sends each one a short message in your gym's name, from your gym's address. You approve the first send before anything goes out.",
  },
  {
    at: 0.68,
    eyebrow: "your front desk",
    title: "They reply, and it books",
    body: "The reply lands with your front desk, not with us. casdey answers in your name and puts the session straight into your calendar.",
  },
];

function Timeline({ geo, maskId }: { geo: Line; maskId: string }) {
  const marks = (xs: number[]) =>
    xs.map((x) => "M" + x + " " + geo.y + "h0").join("");

  return (
    <svg
      viewBox={"0 0 " + geo.w + " " + geo.h}
      className="w-full"
      role="img"
      aria-label="One member's timeline: regular visits, a long silence, a message from the gym, a reply that books a session, then visits again."
    >
      <defs>
        <mask id={maskId}>
          <rect
            className="journey-wipe"
            x="0"
            y="0"
            width={geo.w}
            height={geo.h}
            fill="#fff"
          />
        </mask>
      </defs>

      <g mask={"url(#" + maskId + ")"}>
        {/* Attending. */}
        <line
          x1={geo.run[0]}
          y1={geo.y}
          x2={geo.run[1]}
          y2={geo.y}
          stroke="var(--stone)"
          strokeWidth="1"
          opacity="0.45"
        />
        <path
          d={marks(geo.dots)}
          stroke="var(--ink)"
          strokeWidth={geo.dot}
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Gone. The long part, and the only part of a member's history that
            no gym software has an opinion about. */}
        <line
          x1={geo.gap[0]}
          y1={geo.y}
          x2={geo.gap[1]}
          y2={geo.y}
          stroke="var(--stone)"
          strokeWidth="1.6"
          strokeDasharray="2 10"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* The message, sent into the silence. */}
        <line
          x1={geo.msg}
          y1={geo.y - 20}
          x2={geo.msg}
          y2={geo.y + 20}
          stroke="var(--teal)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={geo.msg} cy={geo.y} r={geo.dot} fill="var(--paper)" />
        <circle cx={geo.msg} cy={geo.y} r={geo.dot * 0.64} fill="var(--teal)" />

        {/* The reply. Amber, once, and nothing else on the page uses it. */}
        <circle
          cx={geo.reply}
          cy={geo.y}
          r={geo.dot * 2.3}
          fill="var(--amber)"
          opacity="0.14"
        />
        <circle cx={geo.reply} cy={geo.y} r={geo.dot} fill="var(--amber)" />

        {/* Attending again. */}
        <line
          x1={geo.back[0]}
          y1={geo.y}
          x2={geo.back[1]}
          y2={geo.y}
          stroke="var(--stone)"
          strokeWidth="1"
          opacity="0.45"
        />
        <path
          d={marks(geo.backDots)}
          stroke="var(--ink)"
          strokeWidth={geo.dot}
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
    </svg>
  );
}

export function MemberJourney() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const height = window.innerHeight;
      // Starts as the block clears most of the viewport and finishes well
      // before it leaves, so the line is never sitting half-drawn while the
      // reader is looking straight at it.
      const start = height * 0.85;
      const end = height * 0.25;
      const p = (start - box.top) / (start - end);
      el.style.setProperty("--p", String(Math.min(1, Math.max(0, p))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className="journey">
      <div className="hidden md:block">
        <Timeline geo={WIDE} maskId="journey-wide" />
      </div>
      <div className="md:hidden">
        <Timeline geo={NARROW} maskId="journey-narrow" />
      </div>

      <ol className="mt-1 grid list-none gap-10 sm:grid-cols-3 sm:gap-8">
        {BEATS.map((beat) => (
          <li
            key={beat.title}
            className="journey-beat border-t border-ash pt-6"
            style={{ "--at": beat.at } as React.CSSProperties}
          >
            <span className="label text-teal">{beat.eyebrow}</span>
            <h3 className="display mt-3 text-[1.3rem] text-ink">
              {beat.title}
            </h3>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-graphite">
              {beat.body}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
