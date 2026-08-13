import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseServer } from "./supabase-server";
import { subscriptionAllowsAccess, type Practice } from "./types";

/**
 * Data access layer.
 *
 * Every route that touches practice data starts here. The auth check lives in
 * this file rather than in the app layout on purpose: layouts do not re-render
 * on client-side navigation, and a layout cannot stop the segments below it
 * from rendering or from appearing in the RSC payload. A layout-only check is
 * decoration, not a gate.
 *
 * `src/proxy.ts` does an optimistic cookie check to keep signed-out visitors
 * from ever reaching a render. That is a redirect, not a security boundary.
 * This file is the boundary.
 *
 * Wrapped in React `cache` so several components in one render share a single
 * round trip.
 */

export type Session = {
  userId: string;
  email: string;
  supabase: SupabaseClient;
};

export type PracticeContext = {
  session: Session;
  practice: Practice;
  role: "owner" | "staff";
};

/**
 * The signed-in user, or null. Uses `getUser()`, which validates the token with
 * Supabase, rather than `getSession()`, which trusts whatever the cookie says.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  let supabase: SupabaseClient;
  try {
    supabase = await supabaseServer();
  } catch (error) {
    // Auth is not configured on this environment. Treat the caller as signed
    // out, so a request to /app lands on /login (which renders without any
    // server-side Supabase) instead of a 500. The error is logged so a genuine
    // misconfiguration is still loud where an operator can see it.
    console.error(
      "[dal] Supabase Auth unavailable",
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { userId: user.id, email: user.email ?? "", supabase };
});

/** Same, but sends anyone without a session to the login page. */
export const requireSession = cache(async (): Promise<Session> => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

/**
 * The practice this user belongs to, read through the user-scoped client so RLS
 * does the tenant filtering rather than a `where` clause we could forget.
 *
 * One practice per user in v1. `practice_members` is already shaped for more.
 */
export const getPracticeContext = cache(
  async (): Promise<PracticeContext | null> => {
    const session = await getSession();
    if (!session) return null;

    const { data, error } = await session.supabase
      .from("practice_members")
      .select("role, practices (*)")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[dal] practice lookup failed", error.message);
      return null;
    }
    if (!data?.practices) return null;

    // The embed is typed as an array by the generated client even though the
    // foreign key makes it a single row.
    const practice = (
      Array.isArray(data.practices) ? data.practices[0] : data.practices
    ) as Practice;

    return {
      session,
      practice,
      role: data.role as "owner" | "staff",
    };
  },
);

/**
 * Everything under /app except onboarding itself. Sends a signed-in user with
 * no practice yet into onboarding.
 */
export async function requirePractice(): Promise<PracticeContext> {
  await requireSession();
  const context = await getPracticeContext();
  if (!context) redirect("/app/onboarding");
  return context;
}

/**
 * For anything that costs money to run or touches patients. A practice whose
 * trial ended without a working card gets bounced to billing.
 */
export async function requireActivePractice(): Promise<PracticeContext> {
  const context = await requirePractice();
  if (!subscriptionAllowsAccess(context.practice.subscription_status)) {
    redirect("/app/settings/billing?expired=1");
  }
  return context;
}

/** Owner-only actions: billing, deletion, processor agreement. */
export async function requireOwner(): Promise<PracticeContext> {
  const context = await requirePractice();
  if (context.role !== "owner") redirect("/app");
  return context;
}
