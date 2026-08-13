import type { NextRequest } from "next/server";

import { drainQueue } from "@/lib/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sending is slow work. The default 10s would cut a batch off part way.
export const maxDuration = 60;

/**
 * Drains the campaign send queue. Runs on a schedule, not from the UI.
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
  // sends email to patients is not something to leave open by accident.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(request: NextRequest): Promise<Response> {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const report = await drainQueue();
    if (report.sent > 0 || report.failed > 0) {
      console.log("[cron] send", JSON.stringify(report));
    }
    return Response.json({ ok: true, ...report });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[cron] send failed", detail);
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
