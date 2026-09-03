import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * This uses the service role key, which bypasses row level security, so it must
 * never be imported into a Client Component or anything that ships to the
 * browser. Server Components and route handlers only.
 */

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  // Newer Supabase projects call this the "secret key" (sb_secret_...). Older
  // ones call it the service_role key. Either works here.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** PostgreSQL unique-violation. Used to spot a repeat signup. */
export const UNIQUE_VIOLATION = "23505";

/** PostgreSQL exclusion-constraint violation (e.g. bookings_no_overlap). */
export const EXCLUSION_VIOLATION = "23P01";
