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
  `NEXT_PUBLIC_SUPABASE_*`, the live `STRIPE_*` set (secret key, 4 prices, 2
  coupons, webhook secret), `RESEND_API_KEY`, `CASDEY_SENDING_ADDRESS`,
  `CRON_SECRET`. Email/password auth works in prod; auth transactional email
  routes through Resend custom SMTP.
- **Google Calendar is NOT wired in prod yet.** `GOOGLE_CALENDAR_*` and
  `CALENDAR_TOKEN_KEY` are deliberately absent from Vercel, so the booking loop
  is inert in production until they're added (plan item B2, after the OAuth
  consent screen is verified, B1). Booking works locally, where they are set.
- **WhatsApp was removed in the pivot** (gyms don't fit the channel). The code
  is recoverable from git history if the niche ever wants it; it is not part of
  the current product.
- **Database:** one Supabase project (`lxnzktbnustbimhdoyyw`, EU/Ireland
  eu-west-1) backs the waitlist and the SaaS. Migrations exist through `0013`
  (`0011` dental→gym rename, `0012` at-risk campaigns, `0013` cancellation
  reason). Whether `0011`–`0013` are applied to the live project is unconfirmed
  (plan item B3) — prod `/app` working suggests they are, but confirm directly.
- **Vercel plan** (Hobby vs Pro) is unconfirmed; the campaign-send cron in
  `vercel.json` runs once daily to stay within the Hobby limit (plan item B5).

## The offer model (implemented) — see `src/lib/plan.ts`

Trial → Free → Premium (Davide's "Offer evolution" in `CLAUDE.md`). The plan is
**derived from the gym row, never stored** (`effectivePlan`), so it can't go
stale; `capabilities(gym)` is the single source of truth for what a gym can do.

- **Free week (trial):** a new signup gets 7 days of full Premium, **no card**.
  Set at onboarding (`trial_ends_at`), casdey-managed, not a Stripe trial.
- **Free plan** (after the week): deliberately limited, and this is the pull to
  upgrade —
  - can import and see the lapsed **count**, but **cannot send campaigns**;
  - **lapsed identities are locked**: only the first `FREE_MEMBER_LIST_LIMIT`
    (5) members are shown by name, the rest sit behind an upgrade card (the true
    total is always visible);
  - **member holding is capped**: `FREE_MEMBER_IMPORT_LIMIT` (50) total, a cap
    on net-new members at import (re-imports that only update existing members
    are never blocked). Both limits added 2026-09-03.
- **Premium:** a real Stripe subscription (card taken at upgrade). £250/mo or
  €290/mo, £225/€262 annually. V1/waitlist-window gyms get a **lifetime
  discount** (£50/€59 off) applied automatically via per-currency coupons.
- **Two env levers, not code:** `CASDEY_TRIAL_ENABLED` and
  `CASDEY_EARLY_ADOPTER_DISCOUNT` (both default on for V1; set `"false"` for V2).
  `early_adopter` is persisted per-gym so eligibility survives into V2.

## What's verified

- `tsc` / `lint` / `next build` clean; **`npm run test` 135/135** as of
  2026-09-03 (dormancy/lapse, CSV parsing + platform headers, phone
  normalisation, the plan model, the Free import cap, the setup checklist,
  calendar availability, and more — the number is a floor, it moves per session).
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

- **WhatsApp** — removed in the pivot (recoverable from git if ever wanted).
- **Real gym-software sync** (Mindbody/Glofox/TeamUp/ABC APIs, and LegitFit) —
  the Mindbody adapter is a stub; **CSV export is the real, universal import
  path** for V1. A direct integration is post-V1.
- **SMS**, invoicing, and any real PMS-diary write other than Google Calendar.
- The **win-back / comeback-offer** interactive page (roadmap #10) — a post-V1
  idea, not started.
