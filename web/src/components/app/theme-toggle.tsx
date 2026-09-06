"use client";

import { useSyncExternalStore } from "react";

/**
 * Light or dark, for the product.
 *
 * The preference lives in localStorage and nowhere else. It is one bit of
 * cosmetic taste per browser, it has to be readable before React runs to stop
 * the page flashing white, and putting it on the gym row would make an
 * individual's eyesight a property of the business every member of staff
 * shares.
 *
 * Read through useSyncExternalStore rather than an effect, so the first render
 * already knows the answer and the toggle never shows the wrong state for a
 * frame. The store is the DOM attribute the no-flash script already set.
 */

const KEY = "casdey-theme";

type Theme = "light" | "dark";

/** The script that runs before paint. Kept here so the two cannot drift. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}})()`;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab switching theme should not leave this one disagreeing.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    apply((event.newValue === "dark" ? "dark" : "light") as Theme, false);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme: Theme, persist: boolean) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // A browser refusing storage is not a reason to refuse the switch. It
      // simply will not survive the next page load.
    }
  }
}

export function ThemeToggle({ compact = false }: { compact?: boolean } = {}) {
  const theme = useSyncExternalStore(
    subscribe,
    currentTheme,
    // Rendered on the server, where there is no document. Light is what the
    // markup ships as, so this is what matches it.
    () => "light" as Theme,
  );

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        apply(next, true);
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
