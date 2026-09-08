"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

/**
 * The visitor half of casdey's own analytics, wired at the root so it covers
 * both the marketing site and /app (see the 2026-09-08 admin-dashboard
 * planning note in CLAUDE.md for why casdey needed this at all).
 *
 * Cookieless on purpose: `cookieless_mode: "always"` sets no cookies and no
 * session/local storage, identifying a visitor with a privacy-preserving hash
 * PostHog computes server-side instead. That is what lets this run with no
 * consent banner on a site that had none before. It only works because the
 * matching "Enable cookieless tracking" toggle was turned on in the PostHog
 * project itself (Settings → Web analytics) — the client flag alone silently
 * drops events if that project-level switch is off.
 *
 * capture_pageview is off in init() and fired by hand below: the App Router
 * does client-side route transitions that never reload the page, so the
 * library's own "fires once on load" pageview would miss every navigation
 * after the first.
 */

let initialised = false;

function initPosthog(): void {
  if (initialised) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  // Not configured (e.g. a preview environment with no PostHog project) — the
  // site works exactly as it did before this existed, it just is not measured.
  if (!key || !host) return;

  posthog.init(key, {
    api_host: host,
    cookieless_mode: "always",
    capture_pageview: false,
    autocapture: true,
  });
  initialised = true;
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!initialised) return;
    const query = searchParams.toString();
    posthog.capture("$pageview", {
      $current_url: query ? `${pathname}?${query}` : pathname,
    });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider() {
  useEffect(() => {
    initPosthog();
  }, []);

  // useSearchParams() requires a Suspense boundary; this component renders
  // nothing, so there is nothing for a fallback to show.
  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}
