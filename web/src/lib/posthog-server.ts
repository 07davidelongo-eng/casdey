import "server-only";

import { PostHog } from "posthog-node";

/**
 * Server-side event capture: the ground-truth half of casdey's funnel.
 *
 * Client-side (see components/posthog-provider.tsx) answers "how many people
 * looked". This answers the parts that must never depend on a browser tab
 * staying open long enough to fire a request: a waitlist row was written, a
 * gym was created, a campaign actually went out, a Stripe Checkout session
 * was actually created or actually completed. Each of those already has a
 * server-side moment of truth (a DB write, a Stripe API call, a webhook), so
 * the event rides along at that moment rather than being inferred from a
 * client click that might never reach us.
 *
 * Uses the same project token as the client snippet (NEXT_PUBLIC_POSTHOG_KEY):
 * that key is write-only and safe in both places, per PostHog's own docs. The
 * read-scoped POSTHOG_PERSONAL_API_KEY is a different key entirely, used only
 * by admin-stats.ts to query numbers back out.
 *
 * Every call site treats this as best-effort: a PostHog outage, or the env
 * vars simply not being set yet, must never fail the actual signup/send/
 * payment it is riding on. captureImmediate() (rather than the batching
 * capture()) is used because these routes run as short-lived serverless
 * functions on Vercel: a batched event queued for a later flush can be lost
 * the moment the function freezes.
 */

let client: PostHog | null | undefined;

function posthogServer(): PostHog | null {
  if (client !== undefined) return client;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  client = key && host ? new PostHog(key, { host }) : null;
  return client;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const posthog = posthogServer();
  if (!posthog) return;

  try {
    await posthog.captureImmediate({ distinctId, event, properties });
  } catch (error) {
    console.error(`[posthog] failed to capture "${event}"`, error);
  }
}
