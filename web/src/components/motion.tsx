"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * The page's motion primitives, in one file.
 *
 * Three rules they all follow. Only transform and opacity animate. Anything
 * that hides or blanks content does so only once the client is running, so a
 * failed script leaves a readable page rather than an empty one. And every
 * one of them checks for reduced motion and renders its finished state
 * directly, because globals.css disables transitions in that mode and an
 * element left part-way through would never arrive.
 *
 * Both of those conditions are facts available at render, not state to be
 * synchronised afterwards, so they come from useSyncExternalStore rather
 * than from an effect that sets state. That is also what keeps this file
 * clear of cascading renders on mount.
 */

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReduceQuery(onChange: () => void) {
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the visitor has asked for less movement. False while rendering on the server. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReduceQuery,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  );
}

const noSubscribe = () => () => {};

/** False in the server's HTML, true once React is running in the browser. */
function useHydrated() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/** Fires once, the first time the element is meaningfully on screen. */
function useInView<T extends HTMLElement>(
  active: boolean,
  rootMargin = "-12% 0px -12% 0px",
) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, rootMargin]);

  return [ref, seen] as const;
}

/**
 * Lifts its children into place as they arrive.
 *
 * The class that hides them is only ever applied in the browser, so the
 * server's HTML has nothing hidden in it to begin with.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const hydrated = useHydrated();
  const still = usePrefersReducedMotion();
  const armed = hydrated && !still;
  const [ref, seen] = useInView<HTMLDivElement>(armed);

  return (
    <div
      ref={ref}
      className={`${armed ? "reveal" : ""} ${seen ? "is-in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Counts to a number once it is on screen.
 *
 * Used on the figures in the product window, because those three numbers are
 * the argument of the page and a number that lands gets read where a number
 * that was always there gets skimmed. Without the browser it renders the
 * finished figure, never a zero.
 */
export function CountUp({
  to,
  prefix = "",
  duration = 1100,
}: {
  to: number;
  prefix?: string;
  duration?: number;
}) {
  const hydrated = useHydrated();
  const still = usePrefersReducedMotion();
  const animates = hydrated && !still;
  const [ref, seen] = useInView<HTMLSpanElement>(animates, "0px");
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!animates || !seen) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Decelerating, so it settles rather than stops.
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animates, seen, to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {(animates ? n : to).toLocaleString("en-GB")}
    </span>
  );
}

/**
 * Types its text out on mount.
 *
 * Only on the message casdey writes, and only inside the step that is about
 * casdey writing it. The caret belongs to the effect, so it leaves when the
 * typing does.
 */
export function Typed({
  text,
  speed = 16,
  className = "",
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const hydrated = useHydrated();
  const still = usePrefersReducedMotion();
  const animates = hydrated && !still;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!animates) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const shown = Math.min(text.length, Math.floor((now - start) / speed));
      setCount(shown);
      if (shown < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animates, text, speed]);

  const shown = animates ? text.slice(0, count) : text;
  const typing = animates && count < text.length;

  return (
    <span className={className}>
      {shown}
      {typing && (
        <span
          aria-hidden="true"
          className="ml-px inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-teal"
        />
      )}
    </span>
  );
}

/**
 * The hero window, laid back and standing up as you scroll to it.
 *
 * Writes the angle to a custom property from one throttled listener rather
 * than to React state, so the page is not re-rendering while the wheel
 * moves. The starting angle is deliberately small: enough that the window
 * reads as an object sitting in the page, not so much that it becomes the
 * trick everyone has seen.
 */
export function TiltWindow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || still) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top;
      const height = window.innerHeight;
      // 1 while the window is still low in the viewport, 0 once it has
      // climbed past a third of the way up.
      const t = Math.min(1, Math.max(0, (top - height * 0.32) / (height * 0.5)));
      el.style.setProperty("--tilt", String(t));
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
  }, [still]);

  return (
    <div ref={ref} className="tilt-stage">
      <div className="tilt-plane">{children}</div>
    </div>
  );
}
