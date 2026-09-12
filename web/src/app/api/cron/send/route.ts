import type { NextRequest } from "next/server";

import { drainQueue } from "@/lib/sender";
import { runTrialJob } from "@/lib/trial-close";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sending is slow work. The default 10s would cut a batch off part way.
export const maxDuration = 60;

/**
 * The daily job. Drains the campaign send queue, then closes out trials
 * (nudges, conversions, setup fees, make-good refunds). Runs on a schedule,
 * not from the UI.
 *
 * Locally:
 *   curl -X POST localhost:3000/api/cron/send -H "authorization: Bearer $CRON_SECRET"
 *
 * On Vercel, add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/send", "schedule": "0 * * * *" }] }
 * Vercel's scheduler sends a GET with its own bearer token, so both verbs are
 * accepted and both are authenticated the same way.
 */

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Refusing when unset is the safe default: an unauthenticated endpoint that
  // sends email to members is not something to leave open by accident.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(request: NextRequest): Promise<Response> {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // The two jobs are run and reported separately, and neither can take the
  // other down. Sending member email and closing out trials have nothing to do
  // with each other; they share this route only because Vercel's Hobby plan
  // caps how many cron schedules casdey may have (confirmed 2026-09-03), and a
  // Stripe outage must not stop a gym's campaign going out.
  const result: {
    ok: boolean;
    send?: unknown;
    trials?: unknown;
    errors: string[];
  } = { ok: true, errors: [] };

  try {
    const report = await drainQueue();
    if (report.sent > 0 || report.failed > 0) {
      console.log("[cron] send", JSON.stringify(report));
    }
    result.send = report;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[cron] send failed", detail);
    result.ok = false;
    result.errors.push(`send: ${detail}`);
  }

  try {
    // Nudges, conversions and releases. Returns an empty
    // report and touches nothing while CASDEY_PAID_TRIAL is off.
    const trials = await runTrialJob();
    if (
      trials.converted +
        trials.nudged +
        trials.released +
        trials.pendingAuth +
        trials.conversionFailed >
      0
    ) {
      console.log("[cron] trials", JSON.stringify(trials));
    }
    result.trials = trials;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[cron] trial job failed", detail);
    result.ok = false;
    result.errors.push(`trials: ${detail}`);
  }

  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = run;
export const POST = run;
