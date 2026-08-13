# casdey SaaS — build handoff

What was built this session, what is verified, and the exact manual steps left
before the product runs end to end. The full design rationale is in the plan at
`.claude/plans/claude-so-this-session-melodic-wren.md`.

## What it is

The product the marketing site promises, built into the same Next.js app under
`/app`: accounts (email/password + Google), a 7-day free trial with a card taken
at signup, patient CSV import, dormant-patient detection, re-engagement email
campaigns, and the GDPR controls that patient data requires. Marketing pages
(`/`, `/waitlist`, `/privacy`) were not touched, so a parallel design session
cannot collide with this work.

## Assumptions taken (the four open questions went unanswered)

1. **Messaging is email, sent by casdey.** No SMS/Twilio in v1. The first
   campaign a practice sends passes an explicit approval screen.
2. **Dentally is stubbed**, not fake. The CSV adapter fully works; the Dentally
   adapter implements the same interface and reports "not connected" until
   credentials exist (`DENTALLY_API_KEY`, `DENTALLY_API_BASE`).
3. **Zero edits to existing files.** Everything is new files, incl. a separate
   `src/styles/product.css`.
4. **Stripe prices created in test mode via API** (done — see below).

If any of these is wrong, say so; each changes real work.

## Verified this session

- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm run test` (vitest) — **38/38 pass**, covering dormancy rules + CSV date/
  column parsing (the two places a silent bug emails the wrong patients)
- `npm run build` — succeeds, all 30 routes registered
- HTTP smoke test (production server): `/`, `/privacy`, `/terms/processing`,
  `/login`, `/u/<token>` all 200; `/app/*` correctly 307-redirects to `/login`
  when signed out. Login page + mode toggle + processing-terms page render with
  brand styling, zero console errors.

## NOT verified (blocked on the manual steps below)

The live interactive flow: real signup → Google OAuth → onboarding → Stripe
checkout → import a CSV → dormant counts → build/approve a campaign → queue
drains → unsubscribe. All the code is in place; it needs the credentials below
to actually run.

## Manual steps to finish P7 (in order)

### 1. Run the database migration
`web/supabase/migrations/0002_saas.sql` in the Supabase SQL editor (same EU
project as the waitlist). Creates 10 tables, RLS policies, the atomic
`create_practice()` function, and per-table `service_role`/`authenticated`
grants (the README's `42501` gotcha is handled for every new table).

### 2. Add the browser-safe Supabase keys to `web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=      # BARE project url, no /rest/v1 (the PGRST125 gotcha)
NEXT_PUBLIC_SUPABASE_ANON_KEY= # anon / publishable key (RLS-bound, safe in browser)
```
The app is currently 100% service-role; these are what turn on Auth.

### 3. Enable Google as an auth provider
In Supabase → Authentication → Providers → Google: create an OAuth client in
Google Cloud, paste client id/secret, and register the callback URL Supabase
shows. Email/password works without this; the "Continue with Google" button
needs it.

### 4. Stripe
Prices were already created in **test mode** (account `acct_1Tz17NDGwemFDmSP`)
and their ids are in `.env.local`:
- £250/mo, £2,700/yr, €290/mo, €3,144/yr
`STRIPE_SECRET_KEY` is copied from the repo-root `.env`. Still needed:
```
STRIPE_WEBHOOK_SECRET=   # from: stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Re-run `node scripts/stripe-setup.mjs` any time; it is idempotent and refuses
live keys.

### 5. (optional) Resend + CRON_SECRET
- `RESEND_API_KEY` — without it, patient email sends via Zoho, which cannot set
  a per-practice reply-to (the practice address is written into the body
  instead). With it + casdey.com verified in Resend, replies land in the
  practice's own inbox.
- `CRON_SECRET` — any long random string; guards `POST /api/cron/send`, which
  drains the campaign queue. Locally:
  `curl -X POST localhost:3000/api/cron/send -H "authorization: Bearer $CRON_SECRET"`
  On Vercel add a cron entry hitting `/api/cron/send`.

### 6. Walk the flow
`npm run dev`, then: sign up (email + Google) → onboarding → billing → Stripe
test checkout with `4242 4242 4242 4242` → import a sample CSV → dashboard
counts → build a campaign → approve → run the cron endpoint → click the
unsubscribe link and confirm the patient is suppressed. Test the Stripe webhook
with `customer.subscription.updated` and `invoice.payment_failed` explicitly —
trial-end is the one thing that silently costs money if wrong.

## Architecture notes worth keeping

- **Two Supabase clients, never confused.** `supabaseAdmin()` (service role,
  bypasses RLS) is for webhooks/cron/import only. `supabaseServer()` (cookie-
  scoped, RLS applies) is every user-facing read/write. A cross-tenant patient
  leak is the worst thing this app can do; RLS is the backstop.
- **Auth lives in the DAL, not the layout** (`src/lib/dal.ts`). Next 16 layouts
  don't re-render on navigation and can't gate child segments, so each page
  calls `requirePractice()` / `requireActivePractice()` itself.
- **Next 16 specifics:** middleware is `src/proxy.ts` (export `proxy`); all of
  `cookies()`/`params`/`searchParams` are async.
- **Dormancy is derived, never stored** (`src/lib/dormancy.ts`). Changing a
  practice's window can't leave stale flags. The in-memory rule and the SQL
  filter are kept side by side so they can't disagree.
- **Every patient email carries a working unsubscribe link**, appended after the
  editable template so a practice can't remove it. Suppression is checked at
  queue time and again at send time.

## Out of scope (deliberately)

Real Dentally sync, SMS, the other three practice-software integrations, live
Stripe keys, invoicing, and the Vercel deploy + DNS move. The trial-fulfilment
gap stays manual: if a practice signs up before this is solid, Davide handles it
personally.
