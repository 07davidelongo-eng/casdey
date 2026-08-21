import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-scoped Supabase client: acts as the signed-in user, so row level
 * security applies.
 *
 * This is the client every user-facing read and write goes through. Its
 * counterpart, `supabaseAdmin()` in ./supabase.ts, uses the service role and
 * bypasses RLS entirely, and is only for webhooks, cron and batch import.
 * Reaching for the wrong one is how a gym ends up reading another
 * gym's members, so the two are deliberately named nothing alike.
 *
 * A new client per request, never a module-level singleton: sharing one across
 * requests would leak one user's session into another's render.
 */

export function publicSupabaseConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Newer projects issue a "publishable" key (sb_publishable_...), older ones
  // an anon JWT. Either is safe in the browser; both are RLS-bound.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase Auth is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  // Guard against the recurring config incident: the dashboard's "Project URL"
  // field is the bare origin, but the REST/GraphQL panels show a URL ending in
  // /rest/v1. Pasting that here builds a client that 404s (PGRST125) on every
  // call. Fail loudly at construction instead of silently in production.
  if (/\/(rest|auth|graphql|storage|realtime)\/v\d/.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be the bare project URL (https://<ref>.supabase.co), with no /rest/v1 or similar path suffix. Got: ${url}`,
    );
  }
  return { url, key };
}

export async function supabaseServer(): Promise<SupabaseClient> {
  // cookies() first, deliberately. Reading it is what tells Next this render is
  // per-request. Throwing on missing configuration before touching it left the
  // route looking static, so the build tried to prerender a signed-in page and
  // failed with a configuration error instead of a useful one.
  const store = await cookies();
  const { url, key } = publicSupabaseConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components cannot write cookies. That is expected and fine:
        // src/proxy.ts refreshes the session on every request, so a token that
        // could not be written here is written there instead.
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a Server Component. Ignore.
        }
      },
    },
  });
}
