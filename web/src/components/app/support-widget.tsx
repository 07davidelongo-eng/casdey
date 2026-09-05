"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import {
  sendFeedbackAction,
  type FeedbackState,
} from "@/app/app/feedback-actions";
import { IconClose, IconHelp } from "./icons";
import { SUPPORT_TOPICS, type SupportTopic } from "./support-topics";

/**
 * The always-there help launcher (roadmap #5).
 *
 * Curated, not AI: it answers from a fixed set of questions a gym actually
 * asks (support-topics.ts), and falls back to a plain email when it cannot.
 * That fallback is a mailto, which opens the gym's own mail client so they
 * send it themselves. casdey never sends anything on their behalf from here.
 *
 * It is chrome, not content: the launcher sits on the same inverted petrol
 * plane as the sidebar, while the panel is a normal raised card so its answers
 * read like the rest of the product.
 *
 * It carries feedback too (Track H1). The whole go-to-market plan runs on
 * feedback and there was nowhere in the product to give any, so it lives here
 * rather than on a surface of its own: this is already where people look when
 * they have something to say, and a second launcher would only compete with
 * this one for the same corner and the same intent.
 */

const SUPPORT_EMAIL = "info@casdey.com";

const FEEDBACK_INITIAL: FeedbackState = { error: null, sent: false };

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

/**
 * The feedback half of the panel.
 *
 * One box and one button. No rating scale and no categories: a gym owner with
 * something to say should be able to say it, and a five-star widget collects a
 * number where casdey needs a sentence. It is attributed rather than anonymous
 * because this is B2B and the point is to start a conversation, which the
 * confirmation says out loud so nobody is surprised by a reply.
 */
function FeedbackView({
  panelId,
  pathname,
  onBack,
}: {
  panelId: string;
  pathname: string;
  onBack: () => void;
}) {
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [state, action, pending] = useActionState(
    sendFeedbackAction,
    FEEDBACK_INITIAL,
  );

  // Mounted means the gym just asked for this box, so put the cursor in it.
  // The parent remounts this component on every entry, which is also what
  // clears a previous send's confirmation.
  useEffect(() => {
    messageRef.current?.focus();
  }, []);

  return (
    <>
      <header className="border-b border-[color-mix(in_srgb,var(--ash)_55%,transparent)] px-5 pb-4 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="label text-teal transition-opacity duration-200 hover:opacity-70"
        >
          &larr; Back
        </button>
        <h2 className="display mt-1 text-[1.25rem]">Tell us what you think</h2>
      </header>

      {state.sent ? (
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <p className="text-[0.9375rem] font-medium text-ink">
            Got it, thank you.
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-graphite">
            Davide reads these himself, usually the same day, and will reply to
            you directly if there is anything to say back.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 text-[0.875rem] font-semibold text-teal underline underline-offset-4 hover:no-underline"
          >
            Back to help
          </button>
        </div>
      ) : (
        <form action={action} className="flex flex-1 flex-col overflow-hidden">
          <input type="hidden" name="path" value={pathname} />

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-3 text-[0.875rem] leading-relaxed text-graphite">
              What is missing, what is in your way, what you would change. Rough
              is fine, we would rather have it rough than not at all.
            </p>
            <label htmlFor={`${panelId}-feedback`} className="sr-only">
              Your feedback
            </label>
            <textarea
              ref={messageRef}
              id={`${panelId}-feedback`}
              name="message"
              rows={6}
              required
              maxLength={4000}
              placeholder="The import kept dropping my..."
              className="w-full rounded-[12px] border border-ash bg-white p-3 text-[0.9375rem] leading-relaxed text-ink"
            />
            {state.error ? (
              <p role="alert" className="mt-2 text-[0.875rem] text-danger">
                {state.error}
              </p>
            ) : null}
          </div>

          <footer className="border-t border-[color-mix(in_srgb,var(--ash)_55%,transparent)] px-5 py-4">
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-[12px] bg-teal-bright px-3 py-2.5 text-[0.9375rem] font-semibold text-deep transition-[filter,opacity] duration-200 hover:brightness-[1.06] disabled:opacity-55"
            >
              {pending ? "Sending..." : "Send it"}
            </button>
            <p className="mt-3 text-[0.8125rem] text-graphite">
              Sent under your own name, so we can write back.
            </p>
          </footer>
        </form>
      )}
    </>
  );
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"help" | "feedback">("help");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Bumped every time the gym leaves the feedback box, so the next visit is a
  // blank form. Without it a second piece of feedback would open on the first
  // one's thank-you.
  const [feedbackKey, setFeedbackKey] = useState(0);

  // Sent with the message so casdey knows where the gym was standing when they
  // said it. The same words mean different things on the import page and on
  // the billing page.
  const pathname = usePathname();

  function leaveFeedback() {
    setView("help");
    setFeedbackKey((n) => n + 1);
  }

  const results = useMemo(
    () => SUPPORT_TOPICS.filter((topic) => matches(topic, query)),
    [query],
  );

  function close(returnFocus = false) {
    setOpen(false);
    setView("help");
    setFeedbackKey((n) => n + 1);
    setQuery("");
    setExpanded(null);
    if (returnFocus) launcherRef.current?.focus();
  }

  // On open, drop the cursor straight into the search so a keyboard user lands
  // where they can act. Focusing a DOM node is exactly the kind of external
  // synchronisation an effect is for.
  useEffect(() => {
    if (open && view === "help") searchRef.current?.focus();
  }, [open, view]);

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
          aria-label={view === "feedback" ? "Send feedback" : "Help and support"}
          className="fixed bottom-[5.75rem] right-4 z-50 flex max-h-[min(34rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[20px] border border-[color-mix(in_srgb,var(--ash)_60%,transparent)] bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] sm:right-6"
        >
          {view === "feedback" ? (
            <FeedbackView
              key={feedbackKey}
              panelId={panelId}
              pathname={pathname}
              onBack={leaveFeedback}
            />
          ) : (
            <>
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
                    Nothing matches that. Tell us below and a real person will
                    get back to you.
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
                            onClick={() => setExpanded(isOpen ? null : topic.id)}
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
                {/* The feedback route comes first, and it is a button rather
                    than a mailto. A mailto opens an empty mail client and asks
                    a gym owner to compose a letter, which is why the old one
                    was a dead end dressed as a door. The address stays
                    underneath for anything that genuinely needs a thread. */}
                <button
                  type="button"
                  onClick={() => setView("feedback")}
                  className="w-full rounded-[12px] border border-ash bg-white px-3 py-2.5 text-[0.9375rem] font-semibold text-ink transition-[border-color,background-color] duration-200 hover:border-stone hover:bg-mist"
                >
                  Tell us what you think
                </button>
                <p className="mt-3 text-[0.8125rem] text-graphite">
                  Or email{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                      "casdey support",
                    )}`}
                    className="font-semibold text-teal underline underline-offset-4 hover:no-underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </footer>
            </>
          )}
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
