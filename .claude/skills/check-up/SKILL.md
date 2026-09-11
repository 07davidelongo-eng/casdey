---
name: check-up
description: >-
  Pulls a live, single-pass snapshot of how casdey is actually doing right
  now — marketing/outreach performance, product and revenue numbers, what
  shipped in the codebase lately plus what's still open, and the business
  summary (unit economics, break-even). Invoke on "/check-up", or when Davide
  asks how the business is going, wants a status check, a pulse check, a
  health check, or "where do things stand". Also runs automatically every
  Sunday via a scheduled routine (see "The weekly routine" below) — when
  invoked that way there is no chat to reply into, so deliver by email
  instead of narrating.
---

# casdey check-up

One pass across every part of the business, read live from the actual
sources, not from memory or from `CLAUDE.md` (which is a decision record, not
a live dashboard, and goes stale between sessions). Built 2026-09-11 at
Davide's request, output "both" (chat summary + a redeployed artifact link
each run) and cadence "on-demand + every Sunday" — see the two scripts and
the artifact this skill maintains for how that's wired.

## The four sections, and where each number comes from

1. **Marketing** — the `Casdey-Gym-Leads` sheet (id
   `1WOAIA1gvK6S1kWe_Vf4-d4XmjhnDLQZLtyU_ezvOu3w`, see `CLAUDE.md` "Stage 1
   progress"), read live via `web/scripts/check-up-marketing.mjs`
   (`npm run checkup:marketing` from `web/`). Same service-account JWT
   pattern the outreach routines already write with
   (`casdey-routine@casdey-gws-cli.iam.gserviceaccount.com`), read-only scope
   (`spreadsheets.readonly`), so this can never touch a live send. Covers:
   - `leads` — status breakdown off the `Leads` tab (Not contacted / Contacted
     / Replied / Interested / Committed / Dead), contacted count, reply rate.
   - `sendLog` — rows off the `Send Log` tab, bucketed by the `Variant`
     column into first-touch (A/B) vs follow-up-1 vs follow-up-2 sends (each
     actual send is its own row; the `Follow-up Sent (Y/N)` columns are a
     per-lead summary flag, not a send count — count rows, not flags), plus
     the CTA variant (A/B) and subject-line variant (S1/S2) splits, plus a
     `sentThisWeek` cut. Sends before the Variant column existed (pre
     2026-09-02) land in `rowTypeCounts.other`, not a bug.
   - `igOutreach` — the `IG Outreach` tab: sends, this-week sends, replies.
   - `testLog` — whatever's in the `Test Log` tab as-is (the weekly test
     review is still a manual Davide+Claude session that fills in the
     Sends/Replies/Winner columns by hand, per `CLAUDE.md` "Marketing plan" —
     this just surfaces the current standing, it does not run that review).

2. **Numbers** (product + revenue + traffic) — `web/scripts/check-up-numbers.mjs`
   (`npm run checkup:numbers`). Three sources in one script:
   - **Supabase**, over `SUPABASE_DB_URL` via `pg`: gyms (real vs
     `is_internal`, paying, trialing, new this week, tier split), product
     usage (members, returned, approved campaigns, messages sent, bookings,
     revenue recovered), and the waitlist count. Always filter `is_internal`
     out of anything presented as a real business number — see
     `admin-stats.ts` for why that flag exists (2026-09-08, `0035`/`0036`:
     `/admin` was once counting internal test gyms as paying customers).
   - **Stripe** (live key, `STRIPE_SECRET_KEY_LIVE`): active/trialing
     subscription counts and an approximate MRR (price unit amount,
     annual ÷ 12, coupon applied — approximate, not the accounting figure).
     **Cross-check this against the DB's `is_internal` flag before reporting
     it as real MRR.** Stripe has no concept of an internal test gym, so an
     active internal subscription (e.g. a stress-test account, or one left
     running past a walkthrough) inflates the raw Stripe number silently.
     Seen live on 2026-09-11: Stripe reported 1 active sub / ~€99 MRR while
     the DB's paying count (which excludes `is_internal`) read 0 — that one
     sub was the internal "Test Admin" gym, not a customer. State the real
     (non-internal) paying count from the DB as the headline figure, and
     mention the Stripe total only as a footnote when it disagrees.
   - **PostHog** (cookieless, EU): 7-day visitors + pageviews via the same
     HogQL host-rewrite `posthog-query.ts` uses (`NEXT_PUBLIC_POSTHOG_HOST`
     with `.i.posthog.com` → `.posthog.com`, `POSTHOG_PROJECT_ID` +
     `POSTHOG_PERSONAL_API_KEY` against the private query API).

3. **Engineering / software** — no script, read directly:
   - `git log --since="7 days ago" --oneline` (repo root) for what actually
     shipped. Group by area (web feature, migration, plan/doc, skill) rather
     than listing raw commit lines.
   - `web/SAAS_V1_PLAN.md` and `web/SAAS_V1_1_PLAN.md` for what's still open —
     read the status tables/track headers, don't re-litigate the reasoning
     inside each track. `SAAS_V1_1_PLAN.md` is the current phase (V1 shipped
     2026-09-07); `SAAS_V1_PLAN.md` §7's board is now historical.
   - Any `Deferred`/`Still open`/`Not done` bullets flagged in `CLAUDE.md`
     itself are fair game too, but don't re-read the whole file every run —
     the plan docs are the maintained source for open items.

4. **Business overview** — read `casdey-hq.md` at the repo root directly
   (it's already the short, current-state summary: the offer, prices, cost
   table, unit economics, break-even, "Where it stands", and "Open"). Don't
   recompute unit economics here, just reflect what it says and flag if a
   number in it looks stale against what sections 1-3 just found (e.g. if it
   says "Paying customers: 0" but Numbers just found 1, that document is due
   an edit — say so, don't silently carry the contradiction).

## Composing the output

**Chat summary** (every on-demand run): short, headline numbers only, one or
two lines of takeaway per section, and call out anything that looks wrong or
contradictory across sources (the Stripe-vs-`is_internal` MRR check above is
exactly this kind of thing). End with the artifact link.

**Artifact** (every run, on-demand or weekly): the fuller version, one page,
same four sections, with the actual figures rather than just the takeaway.
Load `artifact-design` before writing it, same as any artifact. Keep it
skimmable on a phone, since that's the point of publishing it rather than
only printing to chat.

**Same URL every time.** Before publishing, check whether this skill has
already published one: `Artifact action:"list"` and look for the title
"casdey check-up" (or read the URL noted below, once one exists). If found,
`action:"read"` it first (the tool requires reading before republishing to a
URL this session hasn't touched), then publish to that same `url` so it
redeploys in place rather than creating a new artifact. If this is genuinely
the first run ever, publish fresh and then **edit this file** to record the
URL in the line below, so every future run (including the unattended weekly
one) knows where to redeploy without having to search:

> **Artifact URL:** https://claude.ai/code/artifact/e527486a-6a23-4267-8d4e-f9722adbdbbe
> (first published 2026-09-11)

## The weekly routine

Runs automatically every Sunday via a scheduled Claude Routine (set up with
the `schedule` skill, same mechanism as the two outreach routines in
`CLAUDE.md` "Stage 1 progress" — this is a third one, not part of either
existing outreach routine). It has no chat to reply into, so the delivery
step is different from an on-demand run:

1. Do everything above (four sections, compose chat-style summary text,
   publish/redeploy the artifact).
2. Instead of printing the summary to a conversation, write it to a temp
   file and send it by email:
   `node scripts/send-email.mjs davide@casdey.com "casdey check-up — <date>" <path>`
   (`web/scripts/send-email.mjs`, the same Zoho OAuth account
   `src/lib/zoho-mail.ts` already sends from). Put the artifact link at the
   top of the email body, then the same headline-numbers summary.

Set up once via `/schedule`, weekly, Sunday, a time that doesn't collide with
the two outreach routines' `05:05`/`06:00` UTC slots — see `CLAUDE.md`
"Infrastructure" for the pattern (`RemoteTrigger`, not a repo cron).

**Credentials in a cloud routine.** A routine runs in its own cloud
checkout, with no `web/.env.local` and no local service-account key file, so
all three scripts (`check-up-marketing.mjs`, `check-up-numbers.mjs`,
`send-email.mjs`) read `process.env` first and only fall back to
`.env.local` for local runs. The Google service-account key specifically
needs `GOOGLE_SERVICE_ACCOUNT_JSON` (the key file's raw contents) set as an
env var on whichever cloud environment the routine uses — a path
(`GOOGLE_SERVICE_ACCOUNT_FILE`) only works locally. If a weekly run's email
never arrives, `RemoteTrigger action:"list_runs"` then `get_run_log` on it
first — a missing env var on the routine's environment is the most likely
failure, not a bug in the scripts.

## What this deliberately does not do

- It does not run the weekly outreach A/B test review (picking a winner,
  updating the `Test Log` tab) — that stays the manual Davide+Claude session
  `CLAUDE.md`'s "Marketing plan" describes. This skill only surfaces the
  current standing.
- It does not edit `CLAUDE.md`, the plan docs, or `casdey-hq.md` — it reads
  them. Use `/update-project` for that, separately, if a check-up surfaces
  something worth recording.
- It does not write to the outreach sheet, Stripe, or Supabase. Every source
  above is read-only.
