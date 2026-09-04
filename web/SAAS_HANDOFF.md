# casdey SaaS — build handoff

What the product is, how the offer works in code, what's verified, and the
env vars needed to run it. Rewritten 2026-09-03 for the gym/fitness product
(the earlier version described the pre-pivot dental build and is superseded).

> **The path to a ready V1 lives in `SAAS_V1_PLAN.md`** (the single source of
> truth: Track A build / B ops / C prod-verify / D Davide's walkthrough).
> Business, pricing, infrastructure and outreach context live in the root
> `CLAUDE.md`. This file is the product/deployment reference those two point at.

## What it is

A SaaS for **gyms and fitness studios**: it finds **lapsed members** (came once
or twice, or cancelled, and never came back), re-engages them by email in the
gym's own name, and books returns straight into the gym's calendar. Built into
the same Next.js app as the marketing site, under `/app`. Domain model:
**gym / member / booking / service / lapsed / returned** (the dental model —
practice / patient / appointment / dormant — was renamed throughout in the
2026-08 pivot; see `CLAUDE.md`).

## Deployment state (as of 2026-09-03)

- **Marketing homepage `/`** redirects to `/waitlist` in production (gym-facing
  waitlist). **`/app`, `/login`, `/book/*`, `/u/*`, `/terms/*`, `/privacy` are
  reachable in production** — V1 is invited-only, so the homepage stays behind
  the redirect until a separate "go fully public" decision.
- **Email + billing env vars are set in Vercel Production** and `/app` serves:
  `NEXT_PUBLIC_SUPABASE_*`, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`,
  `RESEND_API_KEY`, `CASDEY_SENDING_ADDRESS`, `CRON_SECRET`. Email/password
  auth works in prod; auth transactional email routes through Resend custom
  SMTP. **Not yet in Vercel (Track F, F2):** the 3-tier price ids
  `STRIPE_PRICE_{STANDARD,PRO}_{EUR,GBP}_{MONTH,YEAR}` + `STRIPE_COUPON_PERCENT`
  (the old 4-price / 2-coupon set the code used is retired). A *new* paid
  upgrade can't complete in prod until these are created (test via
  `scripts/stripe-setup.mjs`, live by hand) and set; existing paying gyms are
  unaffected (`plan_tier` backfilled to `pro` by `0016`).
- **Google Calendar is now wired in prod (2026-09-03, plan item B2 done).**
  `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` and
  `CALENDAR_TOKEN_KEY` are set in Vercel Production and deployed; Settings →
  Booking shows "Connected as info@casdey.com" and booking can read/write Google
  Calendar in prod (currently the info@casdey.com connection). **The consent
  screen is published to production (B1 done, 2026-09-03), with no verification
  review required**, so real gym owners can connect and refresh tokens no longer
  die after 7 days. **Standing rule:** `CALENDAR_TOKEN_KEY` must be
  byte-identical in Vercel and local `web/.env.local` — local dev and prod share
  the same Supabase DB, and that key encrypts calendar tokens at rest, so a
  mismatched key shows "Connected" but silently fails to decrypt.
- **WhatsApp was removed in the pivot, then revived for V1 (Track E1, commit
  `cd0fd70`)** after an engaged lead asked for it. The channel code is back
  gym-native, migration `0014` is applied to the live DB, and the UI (Settings
  → WhatsApp, a channel switch on the new-campaign form, a test-send, a
  member-page conversation card) is wired. It does not send in prod yet:
  needs the Twilio account upgraded off the trial tier (plan B8),
  `TWILIO_*` + `ANTHROPIC_API_KEY` in Vercel, and Twilio's inbound webhook
  pointed at `/api/whatsapp/webhook`. Until then it degrades cleanly.
- **Database:** one Supabase project (`lxnzktbnustbimhdoyyw`, EU/Ireland
  eu-west-1) backs the waitlist and the SaaS. Migrations exist through `0014`
  (`0011` dental→gym rename, `0012` at-risk campaigns, `0013` cancellation
  reason, `0014` WhatsApp channel revival, `0015` booking overlap guard,
  `0016` `plan_tier` for 3-tier pricing). **`0011`–`0013` confirmed applied via
  a read-only probe (2026-09-03, plan item B3); `0014`/`0015`/`0016` applied
  the same day in verified transactions over `SUPABASE_DB_URL`.**
- **Vercel plan confirmed Hobby (2026-09-03, plan item B5 done).** The
  campaign-send cron in `vercel.json` runs once daily (`0 3 * * *`) to stay
  within the Hobby once-a-day cron cap; revert to hourly only if upgraded to Pro.

## The offer model (implemented) — see `src/lib/plan.ts`, and `SAAS_V1_PLAN.md` §F0

**3 tiers as of 2026-09-03 (Track F): trial → Free → Standard/Pro.** The
*access state* is **derived from the gym row, never stored** (`effectivePlan`);
the *paid tier* is stored on `gyms.plan_tier` (migration `0016`), written by the
Stripe webhook. `capabilities(gym)` is the single source of truth for what a gym
can do — a per-plan table.

**The webhook resolves the tier from two sources, deliberately (fix 2026-09-04,
commit `223b821`).** Primary is the subscription's price id, reverse-matched
against the `STRIPE_PRICE_*` env vars; fallback is `plan_tier` stamped into
`subscription_data.metadata` by `/api/stripe/checkout`. The single-source version
failed open in the expensive direction: those 9 env vars are entered by hand
(F2), and one missing or mistyped Standard var resolved to nothing, left
`plan_tier` null, and `plan.ts` reads a null tier on an active subscription as
**`pro`**, a €99 Standard gym silently getting WhatsApp and the refundable
guarantee. The price id still wins whenever it resolves; the metadata only
catches the misconfiguration. Covered by `src/lib/stripe.test.ts` (11 tests over
the mapping, the 8-price table and `couponIdFor`, half-configured cases
included), which needed `server-only` aliased to `test/server-only-stub.ts` in
`vitest.config.mts` to make `stripe.ts` importable under vitest.

- **Free week (trial):** 7 days of the **full Pro feature set**, **no card**.
  Set at onboarding (`trial_ends_at`), casdey-managed, not a Stripe trial.
- **Free plan** (after the week): import + see the lapsed **count**, **cannot
  send**; only the first `FREE_MEMBER_LIST_LIMIT` (5) members shown by name;
  `MEMBER_IMPORT_LIMIT.free` = **50** total (net-new cap at import).
- **Standard — €99/mo** (£89; €990/yr): email win-back + at-risk campaigns,
  casdey-owned booking, `MEMBER_IMPORT_LIMIT.standard` = **200**. No WhatsApp,
  no guarantee.
- **Pro — €289/mo** (£249; €2,890/yr): everything in Standard **plus the
  WhatsApp channel and the profit-or-nothing guarantee**,
  `MEMBER_IMPORT_LIMIT.pro` = **2,000** (capped, not unlimited — WhatsApp
  opener cost, see §F0).
- **Early-adopter discount:** a flat **lifetime 20% off** either paid tier — a
  single currency-agnostic `STRIPE_COUPON_PERCENT` (replaces the old
  per-currency £50/€59 fixed coupons; `couponIdFor()` still falls back to them).
- **Existing "Premium" accounts → Pro** (backfilled by `0016`).
- **Two env levers, not code:** `CASDEY_TRIAL_ENABLED` and
  `CASDEY_EARLY_ADOPTER_DISCOUNT` (both default on for V1; set `"false"` for V2).
  `early_adopter` is persisted per-gym so eligibility survives into V2.
- **Not live yet:** the Stripe products/prices/coupon and their env vars —
  `scripts/stripe-setup.mjs` builds the test-mode set; live is Davide's (F2).

## What's verified

- `tsc` / `lint` / `next build` clean; **`npm run test` 164/164** as of
  2026-09-04 (dormancy/lapse, CSV parsing + platform headers, phone
  normalisation, the plan model, the Free import cap, the setup checklist,
  calendar availability, the Stripe price→tier mapping, and more — the number is
  a floor, it moves per session).
- The **full customer path was walked end-to-end pre-pivot** (2026-08-16):
  signup → import → lapsed detection → campaign → Stripe checkout → guarantee
  claim → refund → Google Calendar booking. **It has NOT been re-walked in
  production since the gym rebuild** — that is plan Track C (prod verification)
  and Track D (Davide's walkthrough).
- The self-serve onboarding surfaces (first-run setup checklist, import wizard,
  Free-plan locks, booking fail-closed, support FAQ) were verified in the local
  browser 2026-09-03.

## To run / go live — env vars

In `web/.env.local` (local) or Vercel (production):

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL` (bare project URL, **not** with a
  `/rest/v1` suffix — the code now rejects that), `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Google OAuth (sign-in):** an OAuth client in Supabase → Auth → Providers →
  Google. Email/password works without it; the Google button needs it. The
  consent screen must be published/verified (plan B1) for real prospects.
- **Stripe:** `STRIPE_SECRET_KEY`, four `STRIPE_PRICE_*`, two `STRIPE_COUPON_*`,
  and `STRIPE_WEBHOOK_SECRET`. The webhook endpoint must include **`invoice.paid`**
  (feeds `premium_started_at` + `subscription_payments`, which the guarantee
  needs) and the handler fetches invoices with `expand: ["payments"]`.
- **`RESEND_API_KEY`** + **`CASDEY_SENDING_ADDRESS`**: campaign + auth email via
  Resend (`mail.casdey.com`). Without the key, campaign email falls back to Zoho,
  which can't set a per-gym reply-to.
- **`CRON_SECRET`**: guards `POST /api/cron/send` (drains the send queue);
  `vercel.json` registers the daily cron.
- **Google Calendar (booking):** `GOOGLE_CALENDAR_CLIENT_ID`,
  `GOOGLE_CALENDAR_CLIENT_SECRET` (reuse the "casdey web" OAuth client with the
  Calendar scopes + redirect URIs added), and `CALENDAR_TOKEN_KEY` (AES-256 key
  encrypting stored Google tokens: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
  Set locally; **not on Vercel yet** (B2). Without them, Settings → Booking shows
  "not set up" and booking runs on casdey's own records only. The requested
  scope is `calendar.app.created` + `calendar.freebusy` (narrowed 2026-09-03).
- **Offer flags:** `CASDEY_TRIAL_ENABLED` / `CASDEY_EARLY_ADOPTER_DISCOUNT` —
  unset for V1, `"false"` for V2.

## Local testing

Dev server on `:3000` (`.claude/launch.json`, name `casdey-web`). A confirmed
test account `test@casdey.com` / `casdey-test-1234` exists (skips email
confirmation) — it is the "Bridge Street Gym" fixture, currently on the Free
plan with a small member list, useful for exercising the Free-plan locks. Local
dev points at the live cloud DB (no local Postgres), so `/app` against real data
needs migrations applied there.

## Out of scope (deliberately)

- **Real gym-software sync** (Mindbody/Glofox/TeamUp/ABC APIs, and LegitFit) —
  the Mindbody adapter is a stub; **CSV export is the real, universal import
  path** for V1. A direct integration is Track E2: best-effort V1, allowed to
  slip to V2 if the vendor partner-API wall is too slow.
- **SMS**, invoicing, and any real PMS-diary write other than Google Calendar.
- The **win-back / comeback-offer** interactive page (roadmap #10) — a post-V1
  idea, not started.
