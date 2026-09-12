/**
 * Product/revenue snapshot for /check-up: live Supabase counts, live Stripe
 * subscriptions (for an approximate MRR), and a week of PostHog traffic.
 * Read-only everywhere.
 *
 *   node scripts/check-up-numbers.mjs
 *
 * Prints one JSON object: { gyms, product, waitlist, stripe, traffic }.
 * Mirrors the reasoning in src/lib/admin-stats.ts and src/lib/posthog-query.ts
 * (this script is standalone rather than importing them because those are
 * server-only Next.js modules wired for the request lifecycle, not a plain
 * node run).
 *
 * Supabase access is the REST API (via @supabase/supabase-js), not a direct
 * `pg` connection to the Postgres pooler, even though a local run has both
 * available. Found live, 2026-09-12: the weekly routine's cloud sandbox only
 * lets HTTPS-shaped traffic out through its proxy, so a raw Postgres
 * connection on port 5432 timed out every time, credentials or not, while
 * Stripe and PostHog (both plain HTTPS APIs) worked from the same sandbox
 * without issue. The REST API is the same casdey.com/app uses
 * (src/lib/supabase.ts's supabaseAdmin()) and needs SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY, not SUPABASE_DB_URL.
 */

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// process.env first (how a cloud routine gets its secrets — no .env.local
// exists there), .env.local as the local-dev fallback.
let dotenvCache;
function env(name) {
  if (process.env[name]) return process.env[name];
  if (dotenvCache === undefined) {
    dotenvCache = fs.existsSync("./.env.local") ? fs.readFileSync("./.env.local", "utf8") : "";
  }
  const m = dotenvCache.match(new RegExp(`^${name}=(.+)$`, "m"));
  return m ? m[1].trim() : undefined;
}

// ---------- Supabase (REST, not a direct pg connection — see header) ----------
// Degrades to null (with a reason), same as stripeSnapshot/postHogSnapshot
// below, rather than a bare crash.
async function supabaseSnapshot() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY") ?? env("SUPABASE_SECRET_KEY");
  if (!url || !key) {
    return { error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set" };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: gyms, error: gymsError } = await supabase
      .from("gyms")
      .select("id, is_internal, subscription_status, trial_ends_at, plan_tier, created_at");
    if (gymsError) throw new Error(`gyms: ${gymsError.message}`);

    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const real = gyms.filter((g) => !g.is_internal);

    const gymTotals = {
      real_gyms: real.length,
      internal_gyms: gyms.length - real.length,
      paying: real.filter((g) => g.subscription_status === "active").length,
      trialing: real.filter(
        (g) =>
          g.subscription_status !== "active" &&
          g.trial_ends_at &&
          Date.parse(g.trial_ends_at) > now,
      ).length,
      standard_paying: real.filter(
        (g) => g.plan_tier === "standard" && g.subscription_status === "active",
      ).length,
      pro_paying: real.filter(
        (g) => g.plan_tier === "pro" && g.subscription_status === "active",
      ).length,
      new_this_week: real.filter((g) => Date.parse(g.created_at) > weekAgo).length,
    };

    const gymIds = real.map((g) => g.id);
    let productTotals = {
      members: 0,
      returned: 0,
      campaigns_approved: 0,
      messages_sent: 0,
      bookings: 0,
      revenue_recovered_minor: 0,
    };

    if (gymIds.length > 0) {
      const [membersRes, campaignsRes, messagesRes, bookingsRes] = await Promise.all([
        supabase.from("members").select("status, is_test").in("gym_id", gymIds),
        supabase.from("campaigns").select("approved_at").in("gym_id", gymIds),
        supabase.from("campaign_messages").select("status").in("gym_id", gymIds),
        supabase.from("bookings").select("status, value_minor").in("gym_id", gymIds),
      ]);
      for (const [label, res] of [
        ["members", membersRes],
        ["campaigns", campaignsRes],
        ["messages", messagesRes],
        ["bookings", bookingsRes],
      ]) {
        if (res.error) throw new Error(`${label}: ${res.error.message}`);
      }

      const realMembers = (membersRes.data ?? []).filter((m) => !m.is_test);
      productTotals = {
        members: realMembers.length,
        returned: realMembers.filter((m) => m.status === "returned").length,
        campaigns_approved: (campaignsRes.data ?? []).filter((c) => c.approved_at).length,
        messages_sent: (messagesRes.data ?? []).filter((m) => m.status === "sent").length,
        bookings: (bookingsRes.data ?? []).filter((b) => b.status !== "cancelled").length,
        revenue_recovered_minor: (bookingsRes.data ?? [])
          .filter((b) => b.status === "booked" || b.status === "completed")
          .reduce((sum, b) => sum + (b.value_minor ?? 0), 0),
      };
    }

    const { count: waitlistCount, error: waitlistError } = await supabase
      .from("waitlist_signups")
      .select("id", { count: "exact", head: true });
    if (waitlistError) throw new Error(`waitlist: ${waitlistError.message}`);

    return { gyms: gymTotals, product: productTotals, waitlist: waitlistCount ?? 0 };
  } catch (e) {
    return { error: `Supabase REST query failed: ${e.message}` };
  }
}

// ---------- Stripe (live) ----------
async function stripeSnapshot() {
  const key = env("STRIPE_SECRET_KEY_LIVE") ?? env("STRIPE_SECRET_KEY");
  if (!key) return null;
  const auth = { Authorization: `Bearer ${key}` };
  let mrrMinor = 0;
  const statusCounts = {};
  let startingAfter;
  let guard = 0;
  do {
    const url = new URL("https://api.stripe.com/v1/subscriptions");
    url.searchParams.set("limit", "100");
    url.searchParams.set("status", "all");
    url.searchParams.append("expand[]", "data.discount");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);
    const res = await fetch(url, { headers: auth }).then((r) => r.json());
    if (res.error) throw new Error(`Stripe: ${res.error.message}`);
    for (const sub of res.data) {
      statusCounts[sub.status] = (statusCounts[sub.status] ?? 0) + 1;
      if (sub.status !== "active" && sub.status !== "trialing") continue;
      const percentOff = sub.discount?.coupon?.percent_off ?? 0;
      for (const item of sub.items.data) {
        const perMonth =
          item.price.recurring.interval === "year"
            ? item.price.unit_amount / 12
            : item.price.unit_amount;
        mrrMinor += perMonth * item.quantity * (1 - percentOff / 100);
      }
    }
    startingAfter = res.has_more ? res.data.at(-1)?.id : undefined;
    guard += 1;
  } while (startingAfter && guard < 10);
  return { mrrMinor: Math.round(mrrMinor), statusCounts };
}

// ---------- PostHog (last 7 days) ----------
async function postHogSnapshot() {
  const ingestHost = env("NEXT_PUBLIC_POSTHOG_HOST");
  const projectId = env("POSTHOG_PROJECT_ID");
  const key = env("POSTHOG_PERSONAL_API_KEY");
  if (!ingestHost || !projectId || !key) return null;
  const host = ingestHost.replace(".i.posthog.com", ".posthog.com");
  const query = `
    select uniq(person_id) as visitors, count() as pageviews
    from events
    where event = '$pageview' and timestamp > now() - interval 7 day
  `;
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  }).then((r) => r.json());
  if (res.error) return { error: res.error };
  const [visitors, pageviews] = res.results?.[0] ?? [null, null];
  return { visitors, pageviews };
}

const [supabase, stripe, traffic] = await Promise.all([
  supabaseSnapshot(),
  stripeSnapshot(),
  postHogSnapshot(),
]);

console.log(
  JSON.stringify(
    {
      gyms: supabase.gyms ?? null,
      product: supabase.product ?? null,
      waitlist: supabase.waitlist ?? null,
      supabaseError: supabase.error ?? null,
      stripe,
      traffic,
    },
    null,
    1,
  ),
);
