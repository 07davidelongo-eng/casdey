"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "./ui";

/**
 * Stops a half-finished settings page from being thrown away by a click on
 * the sidebar.
 *
 * Opt-in rather than automatic: it only watches forms carrying
 * data-unsaved-guard. Watching every form on the page would treat a search
 * box, a filter, or the help panel as unsaved work and interrupt navigation
 * over nothing, which trains people to click through the warning without
 * reading it.
 *
 * The dialog does not offer "save and then continue". A save can still fail
 * validation, and a button that promises to carry you somewhere after saving
 * has to either lie when the save fails or strand you in a state nobody
 * designed. So the two honest options are on offer: leave and lose the
 * changes, or save and stay, which is what a person actually wants when they
 * did not realise they had unsaved work.
 */
export function UnsavedChangesGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [dirty, setDirty] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // A route change means the guarded form is gone, along with whatever was
  // typed into it.
  useEffect(() => {
    setDirty(false);
    setPendingHref(null);
    formRef.current = null;
  }, [pathname]);

  useEffect(() => {
    function guardedForm(target: EventTarget | null): HTMLFormElement | null {
      if (!(target instanceof Element)) return null;
      return target.closest("form[data-unsaved-guard]");
    }

    function onEdit(event: Event) {
      const form = guardedForm(event.target);
      if (!form) return;
      formRef.current = form;
      setDirty(true);
    }

    function onSubmit(event: Event) {
      if (!guardedForm(event.target)) return;
      setDirty(false);
    }

    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // Closing the tab or hitting reload is the browser's dialog, not ours. We
  // cannot style it and cannot add a save button to it, but losing the work
  // silently is worse than an ugly prompt.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    function onClick(event: MouseEvent) {
      // Anything the browser would not treat as a plain navigation is left
      // alone: new tabs, downloads, and modified clicks are not the user
      // abandoning the page.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      setPendingHref(url.pathname + url.search);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  if (!pendingHref) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-deep/40 p-5"
    >
      <div className="w-full max-w-[26rem] rounded-[var(--radius-lg)] bg-white p-7 shadow-float">
        <h2 id="unsaved-title" className="display text-[1.375rem] text-ink">
          You have unsaved changes
        </h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-graphite">
          Leaving this page now discards them.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => {
              const form = formRef.current;
              setPendingHref(null);
              form?.requestSubmit();
            }}
          >
            Save changes
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              const href = pendingHref;
              setDirty(false);
              setPendingHref(null);
              if (href) router.push(href);
            }}
          >
            Leave without saving
          </Button>
        </div>
      </div>
    </div>
  );
}
