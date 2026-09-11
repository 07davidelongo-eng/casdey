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
 */

import fs from "node:fs";
import pg from "pg";

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

// ---------- Supabase ----------
// Degrades to null (with a reason), same as stripeSnapshot/postHogSnapshot
// below, rather than a bare crash — an unset SUPABASE_DB_URL used to surface
// as a bare ECONNREFUSED on 127.0.0.1:5432 (pg's default when the
// connection string is undefined), which said nothing about the real cause.
async function supabaseSnapshot() {
  const dbUrl = env("SUPABASE_DB_URL");
  if (!dbUrl) return { error: "SUPABASE_DB_URL is not set" };

  const db = new pg.Client({ connectionString: dbUrl });
  try {
    await db.connect();
  } catch (e) {
    return { error: `SUPABASE_DB_URL set but connect failed: ${e.message}` };
  }
  const q = async (sql) => (await db.query(sql)).rows;

  try {
    const [gymTotals] = await q(`
      select
        count(*) filter (where not is_internal) as real_gyms,
        count(*) filter (where is_internal) as internal_gyms,
        count(*) filter (where not is_internal and subscription_status = 'active') as paying,
        count(*) filter (where not is_internal and trial_ends_at > now() and subscription_status <> 'active') as trialing,
        count(*) filter (where not is_internal and plan_tier = 'standard' and subscription_status = 'active') as standard_paying,
        count(*) filter (where not is_internal and plan_tier = 'pro' and subscription_status = 'active') as pro_paying,
        count(*) filter (where not is_internal and created_at > now() - interval '7 days') as new_this_week
      from gyms
    `);

    const [productTotals] = await q(`
      select
        (select count(*) from members m join gyms g on g.id = m.gym_id where not g.is_internal and not m.is_test) as members,
        (select count(*) from members m join gyms g on g.id = m.gym_id where not g.is_internal and not m.is_test and m.status = 'returned') as returned,
        (select count(*) from campaigns c join gyms g on g.id = c.gym_id where not g.is_internal and c.approved_at is not null) as campaigns_approved,
        (select count(*) from campaign_messages cm join gyms g on g.id = cm.gym_id where not g.is_internal and cm.status = 'sent') as messages_sent,
        (select count(*) from bookings b join gyms g on g.id = b.gym_id where not g.is_internal and b.status <> 'cancelled') as bookings,
        (select coalesce(sum(b.value_minor), 0) from bookings b join gyms g on g.id = b.gym_id where not g.is_internal and b.status in ('booked','completed')) as revenue_recovered_minor
    `);

    const [waitlist] = await q(`select count(*) as n from waitlist_signups`);

    return { gyms: gymTotals, product: productTotals, waitlist: waitlist.n };
  } finally {
    await db.end();
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
