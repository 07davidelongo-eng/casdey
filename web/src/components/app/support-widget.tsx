"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { IconClose, IconHelp } from "./icons";
import { SUPPORT_TOPICS, type SupportTopic } from "./support-topics";

/**
 * The always-there help launcher (roadmap #5).
 *
 * Curated, not AI: it answers from a fixed set of questions a practice actually
 * asks (support-topics.ts), and falls back to a plain email when it cannot.
 * That fallback is a mailto, which opens the practice's own mail client so they
 * send it themselves. casdey never sends anything on their behalf from here.
 *
 * It is chrome, not content: the launcher sits on the same inverted petrol
 * plane as the sidebar, while the panel is a normal raised card so its answers
 * read like the rest of the product.
 */

const SUPPORT_EMAIL = "info@casdey.com";

function matches(topic: SupportTopic, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    topic.question,
    ...topic.answer,
    ...topic.keywords,
  ]
    .join(" ")
    .toLowerCase();
  // Every word in the query must appear somewhere, so "delete data" narrows
  // rather than widening the way a single-term OR match would.
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => SUPPORT_TOPICS.filter((topic) => matches(topic, query)),
    [query],
  );

  function close(returnFocus = false) {
    setOpen(false);
    setQuery("");
    setExpanded(null);
    if (returnFocus) launcherRef.current?.focus();
  }

  // On open, drop the cursor straight into the search so a keyboard user lands
  // where they can act. Focusing a DOM node is exactly the kind of external
  // synchronisation an effect is for.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Escape closes from anywhere; a click outside the panel and its launcher
  // closes too. Both only listen while open.
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close(true);
    }

    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        launcherRef.current?.contains(target)
      ) {
        return;
      }
      close();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Help and support"
          className="fixed bottom-[5.75rem] right-4 z-50 flex max-h-[min(34rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[20px] border border-[color-mix(in_srgb,var(--ash)_60%,transparent)] bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] sm:right-6"
        >
          <header className="border-b border-[color-mix(in_srgb,var(--ash)_55%,transparent)] px-5 pb-4 pt-5">
            <p className="label text-teal">Support</p>
            <h2 className="display mt-1 text-[1.25rem]">How can we help?</h2>
            <div className="mt-3">
              <label htmlFor={`${panelId}-search`} className="sr-only">
                Search help
              </label>
              <input
                ref={searchRef}
                id={`${panelId}-search`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search, e.g. unsubscribe"
                className="field"
              />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {results.length === 0 ? (
              <p className="px-2 py-6 text-center text-[0.9375rem] text-graphite">
                Nothing matches that. Email us below and a real person will get
                back to you.
              </p>
            ) : (
              <ul className="space-y-1">
                {results.map((topic) => {
                  const isOpen = expanded === topic.id;
                  return (
                    <li key={topic.id}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setExpanded(isOpen ? null : topic.id)
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-left text-[0.9375rem] font-medium text-ink transition-[background-color] duration-200 hover:bg-mist"
                      >
                        <span>{topic.question}</span>
                        <span
                          aria-hidden="true"
                          className={`shrink-0 text-stone transition-transform duration-200 ${
                            isOpen ? "rotate-45" : ""
                          }`}
                        >
                          +
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="px-3 pb-3 pt-1">
                          {topic.answer.map((paragraph, index) => (
                            <p
                              key={index}
                              className="mb-2 text-[0.875rem] leading-relaxed text-graphite last:mb-0"
                            >
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="border-t border-[color-mix(in_srgb,var(--ash)_55%,transparent)] px-5 py-4">
            <p className="text-[0.875rem] text-graphite">
              Still stuck?{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                  "casdey support",
                )}`}
                className="font-semibold text-teal underline underline-offset-4 hover:no-underline"
              >
                Email us
              </a>{" "}
              and we will help.
            </p>
          </footer>
        </div>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "Close help" : "Get help"}
        className="on-deep fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-deep text-teal-bright shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)] transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-deep-raised active:translate-y-0 sm:right-6"
      >
        {open ? (
          <IconClose className="h-6 w-6" />
        ) : (
          <IconHelp className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
