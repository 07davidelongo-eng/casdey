"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, used only for the auth handshake: sign in, sign up,
 * password reset, and the Google redirect. Patient data is never fetched from
 * the browser, it is rendered on the server.
 */

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase Auth is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  // See publicSupabaseConfig() in ./supabase-server.ts: reject a URL carrying a
  // /rest/v1 (or similar) suffix rather than let it silently break auth.
  if (/\/(rest|auth|graphql|storage|realtime)\/v\d/.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be the bare project URL (https://<ref>.supabase.co), with no /rest/v1 or similar path suffix. Got: ${url}`,
    );
  }

  client = createBrowserClient(url, key);
  return client;
}
