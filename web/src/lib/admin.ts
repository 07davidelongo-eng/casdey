import "server-only";

import { redirect } from "next/navigation";

import { requireSession, type Session } from "./dal";

/**
 * The founder-only gate for /admin.
 *
 * casdey is a one-person business (see CLAUDE.md "Stage 1"), so there is no
 * staff/internal role to check against in the database, only a fixed
 * allowlist of emails. It lives in an env var rather than a hardcoded string
 * so it can be widened without a code change, the same reasoning as
 * trialEnabledForNewSignups() in ./plan.ts.
 *
 * This is the real boundary, checked on every request. src/proxy.ts's /admin
 * match is the same convenience redirect it already does for /app: it keeps a
 * signed-out visitor from ever reaching the render, it is not what makes the
 * route safe.
 *
 * The default covers both of Davide's own addresses, not just davide@casdey.com:
 * his day-to-day dev/testing login is his personal Gmail
 * (07davide.longo@gmail.com, see CLAUDE.md's userEmail), which would
 * otherwise get bounced to /app on his own machine.
 */
function adminEmails(): string[] {
  const raw =
    process.env.CASDEY_ADMIN_EMAILS ??
    "davide@casdey.com,07davide.longo@gmail.com";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.toLowerCase());
}

/** Sends anyone signed in but not on the allowlist to their own gym, and
 *  anyone signed out to /login, same as requireSession(). */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!isAdminEmail(session.email)) redirect("/app");
  return session;
}
