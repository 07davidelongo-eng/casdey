"use client";

import { useSyncExternalStore } from "react";

import { Card, CardTitle } from "@/components/app/ui";

/**
 * The gym's actual Google Calendar, in the page (#62).
 *
 * Off by default and remembered per browser. casdey's own calendar is the one
 * that knows which member is coming and what they were promised; this is the
 * gym's whole diary, everything else included, and some gyms will want both on
 * one screen.
 *
 * What it cannot do, said here rather than discovered: this is Google's own
 * embed, so it shows what Google will show whoever is looking. It works when
 * you are signed in to that Google account in this browser, or when the
 * calendar is shared publicly. casdey's own read access is free/busy only, on
 * purpose, so it could not render this itself even if it wanted to.
 */

const KEY = "casdey-calendar-embed";

/**
 * Read straight from localStorage through useSyncExternalStore.
 *
 * Not an effect that calls setState: that renders once with the wrong answer
 * and then corrects itself, which is a flicker, and it is what the project's
 * lint rule is there to stop. This renders false on the server, reads the real
 * value on the client's first render, and re-reads when the switch moves.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    // A browser refusing storage is not a reason to break the page.
    return false;
  }
}

function setOn(next: boolean) {
  try {
    localStorage.setItem(KEY, next ? "on" : "off");
  } catch {
    // The switch still works for this visit, it just will not be remembered.
  }
  for (const listener of listeners) listener();
}

export function GoogleEmbed({
  email,
  timeZone,
}: {
  email: string;
  timeZone: string;
}) {
  const on = useSyncExternalStore(subscribe, isOn, () => false);

  const src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
    email,
  )}&ctz=${encodeURIComponent(timeZone)}&mode=WEEK&showTitle=0&showPrint=0&showTabs=1&showCalendars=0`;

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Your Google Calendar</CardTitle>
          <p className="mt-1 max-w-[60ch] text-[0.875rem] leading-relaxed text-stone">
            Everything in{" "}
            <span className="literal text-graphite">{email}</span>, not only
            what casdey booked. It loads from Google, so it shows what Google
            shows you: you need to be signed in to that account in this browser.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2.5 text-[0.9375rem] text-ink">
          <input
            type="checkbox"
            checked={on}
            onChange={(event) => setOn(event.target.checked)}
            className="h-4 w-4 accent-[var(--teal)]"
          />
          Show it here
        </label>
      </div>

      {on ? (
        <div className="mt-5 overflow-hidden rounded-[12px] border border-ash">
          <iframe
            src={src}
            title={`Google Calendar for ${email}`}
            className="block h-[600px] w-full border-0"
            loading="lazy"
          />
        </div>
      ) : null}
    </Card>
  );
}
