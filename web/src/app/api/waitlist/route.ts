import type { NextRequest } from "next/server";
import {
  addToWaitlist,
  confirmToGym,
  notifyTeam,
  validate,
} from "@/lib/waitlist";

// Server-only: this route holds the Supabase service role key and the Zoho
// credentials, neither of which may reach the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A person needs at least a couple of seconds to fill this in. A bot does not. */
const MIN_FILL_MS = 1_500;

const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

/*
 * Best-effort in-process rate limit. On serverless this is per instance, so it
 * is a speed bump rather than a guarantee. The honeypot and the timing check do
 * most of the real work. If signups ever get abused, move this to a shared store.
 */
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT.windowMs,
  );
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5_000) hits.clear();
  return recent.length > RATE_LIMIT.max;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  // Not stored anywhere. Held in memory only, for the length of the window.
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Malformed request." }, 400);
  }

  // Honeypot: a hidden field only an automated submitter would fill in.
  if (typeof payload.website === "string" && payload.website.trim() !== "") {
    // Look like a success so the bot does not learn anything and move on.
    return json({ ok: true }, 200);
  }

  const elapsed = payload.elapsedMs;
  if (typeof elapsed === "number" && elapsed >= 0 && elapsed < MIN_FILL_MS) {
    return json({ ok: true }, 200);
  }

  if (rateLimited(clientKey(request))) {
    return json(
      {
        ok: false,
        error:
          "That is a few attempts in a row. Wait a moment, or email info@casdey.com and we will add you by hand.",
      },
      429,
    );
  }

  const checked = validate(payload);
  if (!checked.ok) return json({ ok: false, error: checked.error }, 400);

  try {
    const result = await addToWaitlist(checked.value);

    // Neither email is allowed to fail the signup. The row is already saved.
    if (!result.duplicate) {
      await Promise.allSettled([
        notifyTeam(checked.value),
        confirmToGym(checked.value),
      ]);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error("[waitlist] storage failed", error);

    // Storage is down. Rather than lose the signup, try to get it to the team
    // by email, and only report failure if that fails too.
    try {
      await notifyTeam(checked.value);
      return json({ ok: true }, 200);
    } catch (fallbackError) {
      console.error("[waitlist] fallback notification failed", fallbackError);
      return json(
        {
          ok: false,
          error:
            "We could not save that just now. Email info@casdey.com and we will add you by hand.",
        },
        503,
      );
    }
  }
}
