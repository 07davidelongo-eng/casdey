"use client";

import { useSyncExternalStore } from "react";

/**
 * Light or dark, for the product.
 *
 * The preference is a cookie, and a cookie rather than localStorage for one
 * reason: the server can read it. localStorage cannot be read during a server
 * render, so the old version needed an inline script to stamp the theme onto
 * the document before paint, and that script is exactly what made React report
 * a hydration failure on every page load. Now the shell renders the right
 * theme in the first place and there is nothing to correct afterwards.
 *
 * Still per browser rather than on the gym row: it is one bit of cosmetic
 * taste, and putting it on the business would make one person's eyesight a
 * property every member of staff shares.
 *
 * Read through useSyncExternalStore rather than an effect, so the toggle never
 * shows the wrong state for a frame. The store is the data-theme attribute on
 * the shell; the server's answer comes in as a prop, so the two agree.
 */

export const THEME_COOKIE = "casdey-theme";

export type Theme = "light" | "dark";

/** A year, because a preference that quietly expires is worse than none. */
const MAX_AGE = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();

/** The element the theme lives on: the app shell, not the document. */
function root(): HTMLElement | null {
  return document.querySelector("[data-theme]");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function currentTheme(): Theme {
  return root()?.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  const element = root();
  if (element) element.dataset.theme = theme;
  // A cookie rather than localStorage, so the server renders the right theme
  // in the first place. localStorage cannot be read during a server render,
  // which is why the old version needed a script and why that script made
  // React report a hydration failure on every page load.
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

export function ThemeToggle({
  initial,
  compact = false,
}: {
  /** What the server rendered, so hydration has nothing to disagree about. */
  initial: Theme;
  compact?: boolean;
}) {
  const theme = useSyncExternalStore(
    subscribe,
    currentTheme,
    // Rendered on the server, where there is no document. The shell already
    // read the cookie, so this is the same answer rather than a guess.
    () => initial,
  );

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        apply(next);
        for (const listener of listeners) listener();
      }}
      aria-label={`Switch to ${next} mode`}
      className={
        compact
          ? "rounded-md p-2 text-teal transition-colors duration-200 hover:bg-mist"
          : "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.875rem] text-stone transition-colors duration-200 hover:bg-mist hover:text-ink"
      }
    >
      <span aria-hidden="true" className={compact ? "" : "text-teal"}>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
      {compact ? null : theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v1.5M10 16.5V18M18 10h-1.5M3.5 10H2M15.7 4.3l-1 1M5.3 14.7l-1 1M15.7 15.7l-1-1M5.3 5.3l-1-1" />
    </svg>
  );
}
