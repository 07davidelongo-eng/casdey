# casdey SaaS — build handoff

What the product is, how the offer works in code, what's verified, and the
exact steps left to go live. Design rationale for the original build is in the
plan at `.claude/plans/claude-so-this-session-melodic-wren.md`.

## What it is

The product the marketing site promises, built into the same Next.js app under
`/app`: accounts (email/password + Google), patient CSV import, dormant-patient
detection, re-engagement email campaigns, Stripe-billed Premium, and the GDPR
controls patient data requires. All additive: new routes/files only, so the
landing and waitlist pages are untouched.

## Deployment state (as of 2026-08-14)

- **Landing + waitlist are LIVE** at https://casdey.com (Vercel, `main`, DNS
  moved off GoDaddy; Zoho email untouched). Vercel is now on a **paid** plan
  (card added), so the trial-expiry risk is gone.
- **The SaaS ships but is inert in production.** `/app` and `/login` exist in
  the deployed code, but production env vars are the waitlist-safe set only, so
  Supabase Auth / Stripe / sending are unconfigured and the app can't
  authenticate anyone. Going live is purely: add the env vars in Vercel (below)
  — no redeploy-from-scratch.
- **Database:** one Supabase project (`lxnzktbnustbimhdoyyw`, EU/Ireland
  eu-west-1 — corrected 2026-08-15, earlier docs said Frankfurt) backs both
  the waitlist and the SaaS. Migrations through `0006` are **applied** (run
  directly via `pg`, since the earlier SQL-editor attempts only ever applied
  fragments — that saga is resolved).

## The offer model (implemented) — see `src/lib/plan.ts`

Trial → Free → Premium, per Davide's "Offer evolution" in CLAUDE.md:

- **Free week (trial):** a new signup in the V1/waitlist window gets 7 days of
  full Premium, **no card taken**. Set at onboarding (`trial_ends_at`), managed
  by casdey, never by Stripe.
- **Free plan:** when the week ends the account drops to Free. Free **can import
  its list and see who's dormant** (the teaser) but **cannot send campaigns**
  (the gated action). Nothing is charged on Free.
- **Premium:** a real Stripe subscription entered by upgrading (card taken
  then). £250/mo or €290/mo, £225/€262 annually. Early-adopter practices get a
  **lifetime discount** (£50/€59 off, forever) applied automatically at
  checkout via per-currency Stripe coupons.
- **V2 later:** the free week retires for new signups; existing early adopters
  keep their discount.

Key design points:
- **Plan is derived, never stored** — `effectivePlan(practice)` decides from
  `subscription_status` + `trial_ends_at`. Same philosophy as dormancy: no
  stale flags. `capabilities(practice)` is the single source of truth for
  `canSendCampaigns`.
- **Two levers are env flags, not code:** `CASDEY_TRIAL_ENABLED` and
  `CASDEY_EARLY_ADOPTER_DISCOUNT` (both default on for V1; set `"false"` in
  Vercel for V2). `early_adopter` is persisted per-practice so eligibility
  survives into V2.
- **The offer is expected to keep changing** — the model is centralized in
  `plan.ts` for exactly that reason.

### Still an open product decision
The Free plan's limits are currently: **import + view dormant = yes, send =
no**, and nothing else restricted. That's a sensible default that creates the
upgrade pull, but the exact shape ("A LOT of limitations" per Davide) is a
product call — e.g. a patient-count cap, or capping the dormant list preview.
Those are easy to add in `capabilities()` when decided.

## Verified

- `npx tsc --noEmit`, `npm run lint`, `npm run build` — all clean
- `npm run test` — **50/50 pass** (dormancy rules, CSV parsing, and the plan
  model: trial/free/premium derivation + send gating)
- The onboarding RPC path was exercised end-to-end against the live DB
  (create_practice via the API, then cleaned up)
- Login page + auth handshake render; `/app/*` correctly redirects to `/login`

### Not yet verified (blocked on env below)
The upgrade-with-discount half of the loop, which needs real Stripe: Free
send-gate → upgrade → send. Code is in place; needs the keys.

The rest of the loop **was** walked end-to-end on 2026-08-14 (signup → free
week → import → build a campaign → approve → real send attempt) with a fake
12-patient CSV against the local dev server. Import and dormancy detection
worked exactly as designed (8/12 correctly flagged dormant). The send itself
surfaced the gap below.

### Go-live blocker: campaign email has no per-practice sending identity — fixed locally 2026-08-15
`emailProvider()` in `src/lib/messaging.ts` picks Zoho whenever `RESEND_API_KEY`
is unset. Zoho can only send as **casdey's own `info@casdey.com`**, not the
practice, and per the code's own comment it **cannot set a reply-to at all**
("Zoho rejects any reply-to address it has not verified, which an arbitrary
practice inbox never will be").

Confirmed live on 2026-08-14: approving a test campaign queued 8 real send
attempts through the real Zoho account. Zoho rejected all 8 with `550 5.4.6
Unusual sending activity detected`, its abuse/rate-limit trigger, almost
certainly because this is the **same Zoho account the real cold-outreach
automation sends cold emails from** — a second unrelated burst read as spam
activity.

**Fixed locally 2026-08-15:** created a Resend account, added `mail.casdey.com`
as a verified sending domain (a subdomain, so Zoho's own MX/SPF/DKIM on the
root `casdey.com` are untouched), added the required DNS records at GoDaddy,
and set `RESEND_API_KEY` + `CASDEY_SENDING_ADDRESS=no-reply@mail.casdey.com`
in `web/.env.local`. Confirmed locally: the campaign builder's "replies go to
casdey" warning no longer renders, meaning `emailProvider()` now picks Resend.

**Still open before real practices can send:** the same two env vars
(`RESEND_API_KEY`, `CASDEY_SENDING_ADDRESS`) need adding to **Vercel**
production — not done yet, deliberately, consistent with the rest of `/app`
staying inert in prod (see Infrastructure below). Also, no real send has been
approved end-to-end through Resend yet (only confirmed the provider switch,
not an actual delivered email) — worth a real test send before relying on it.

## To go live / to test the full flow — env vars

In `web/.env.local` (local) or Vercel (production):

- **Supabase Auth:** `NEXT_PUBLIC_SUPABASE_URL` (bare project URL, not
  `/rest/v1`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`. *(Set locally already.)*
- **Google OAuth:** create an OAuth client, paste into Supabase → Auth →
  Providers → Google, register the callback URL. Email/password works without
  it; the Google button needs it.
- **Stripe:** `STRIPE_SECRET_KEY`, the four `STRIPE_PRICE_*`, and the two
  `STRIPE_COUPON_*` ids. *(All set locally; run `node scripts/stripe-setup.mjs`
  to (re)create products, prices, and coupons — idempotent, test-only.)*
- **`STRIPE_WEBHOOK_SECRET`** from `stripe listen --forward-to
  localhost:3000/api/stripe/webhook` (local) or the endpoint secret (prod).
  Without it, an upgrade won't sync back to `subscription_status`. The prod
  endpoint must have **`invoice.paid`** enabled alongside the subscription
  events (added 2026-08-15 for the guarantee, see `SAAS_ROADMAP.md` #8) — without
  it, `practices.premium_started_at` and `subscription_payments` never get
  written, and the guarantee can never start or find anything to refund.
- **`RESEND_API_KEY`** (optional): without it, campaign email sends via Zoho,
  which can't set a per-practice reply-to. With it + casdey.com verified,
  replies land in the practice's own inbox.
- **`CRON_SECRET`** guards `POST /api/cron/send` (drains the send queue). Add a
  Vercel cron hitting that path.
- **Offer flags** `CASDEY_TRIAL_ENABLED` / `CASDEY_EARLY_ADOPTER_DISCOUNT`:
  leave unset for V1; `"false"` for V2.
- **WhatsApp (roadmap #2, built 2026-08-15, not yet live anywhere):**
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (E.164, no
  `whatsapp:` prefix — the code adds it), and `ANTHROPIC_API_KEY` for the AI
  reply loop (`CASDEY_WHATSAPP_AI_MODEL` optionally overrides the default
  `claude-haiku-4-5-20251001`). None of these are set anywhere, including
  locally: WhatsApp sending is one shared casdey Twilio number for every
  practice (see `src/lib/whatsapp/`), and going live for real (outside
  Twilio's WhatsApp Sandbox) additionally needs Twilio WhatsApp Business API
  access, Meta Business verification, and at least one Meta-approved message
  template (its Content SID goes in Settings → WhatsApp per practice, not in
  an env var) — external, manual steps Davide has to complete himself, same
  class of setup as the Resend domain verification above. Twilio's inbound
  webhook must point at `/api/whatsapp/webhook`.

## Local testing (current session)

DB is migrated and ready; dev server runs on `:3000` (per `.claude/launch.json`;
an earlier session used `:3002`, since killed); a confirmed test account
`test@casdey.com` / `casdey-test-1234` exists (skips email confirmation). To
see Import + Campaigns as a paid user without running Stripe, a practice's
`trial_ends_at` can be extended or `subscription_status` set to `active`
directly — but a fresh signup already lands in the 7-day trial with full access.

`CRON_SECRET` in local `.env.local` was empty (fails closed by design, see
`src/app/api/cron/send/route.ts`) and is now set to a random local-only value
so `POST /api/cron/send` can be tested manually. `RESEND_API_KEY` is still
unset locally, so draining the queue sends through the real Zoho account (see
go-live blocker above) — be aware of that before running the drain again.

## Out of scope (deliberately)

Real Dentally sync, SMS, the other practice-software integrations, live Stripe
keys, invoicing. The Free plan's deeper limits (above) are a pending product
decision, not built. WhatsApp (previously listed here) is now built, see
above and `SAAS_ROADMAP.md` #2 — SMS specifically remains out of scope.
