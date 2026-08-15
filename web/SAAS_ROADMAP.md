# casdey SaaS — fixes & features roadmap

Davide's list of software fixes/features to tackle before V1, dictated
2026-08-14. Captured verbatim-in-intent here so it persists; we work these one
at a time (or in small batches), not all at once. Current build state is in
`SAAS_HANDOFF.md`; the offer model is in `src/lib/plan.ts`.

Status key: `todo` / `in progress` / `done`. Update as we go.

---

## 1. AI-assisted message writing + language selection — `reverted, language kept`
Originally scoped as manual template **or** AI drafting, plus a language
selector. Built 2026-08-14, then reverted the same window: Davide decided
against embedding AI drafting for a task this small, since it's a standing
cost (`ANTHROPIC_API_KEY` usage) for a feature nobody's asked for yet.

**Reverted 2026-08-15:**
- Removed the "Start from the template / Draft with AI" toggle, the guidance
  textarea, and `draftWithAi` from `web/src/app/app/campaigns/new/form.tsx` —
  the form is manual-template-only again, as it was before this item started.
- Removed `generateDraftAction` from `web/src/app/app/campaigns/actions.ts`.
- Deleted `web/src/lib/ai.ts` and the `@anthropic-ai/sdk` dependency
  (`web/package.json`, lockfile updated).
- Removed the `ANTHROPIC_API_KEY` / `CASDEY_AI_MODEL` section from
  `SAAS_HANDOFF.md`.
- Verified: tsc / lint / test (59/59) all clean after the revert.

**Kept, because Davide explicitly asked to keep them:**
- The **language selector** on the new-campaign form (7 markets, defaulted
  from the practice's country, `web/src/lib/languages.ts`) — the practice
  still picks a language, they just also write the message themselves in it.
- `campaigns.language` column (migration `0006`) and the `Campaign.language`
  type — unaffected, still applied to the live DB.
- Item #7 (price list + revenue) — entirely separate, untouched by this revert.

**Status: done** (as "not doing AI, language + pricing kept"). Not on the
roadmap to revisit unless the cost/demand picture changes.

## 2. WhatsApp channel with a responsive AI agent — `todo`
Add WhatsApp as a contact channel alongside email. Here the AI must be
**responsive and personalized**, behaving like a chatbot: it holds a real
back-and-forth with the patient, not a single templated send.
- Touches: WhatsApp Business API (provider TBD, e.g. Twilio/360dialog), inbound
  webhook, conversation state, AI reply loop, booking hand-off.
- Big; standalone channel work. Depends on send infra being solid (#6).

## 3. Google sign-in — `done`
Wire up the Google login button (already stubbed). Needs a Google OAuth client
configured in Supabase → Auth → Providers → Google + callback URL registered.

**Done 2026-08-15:** the app code was already fully wired (`auth-form.tsx`'s
`signInWithOAuth`, `auth/callback/route.ts`'s code exchange) — nothing to
build there. Completed the external config instead:
- Created a Google Cloud project (`casdey`) and OAuth consent screen (External,
  authorised domain `casdey.com`) under `info@casdey.com`.
- Created an OAuth 2.0 Web client (`casdey web`) with JS origin
  `https://casdey.com` and redirect URI
  `https://lxnzktbnustbimhdoyyw.supabase.co/auth/v1/callback`.
- Pasted the Client ID into Supabase → Auth → Providers → Google (Davide
  pasted the Client Secret himself) and enabled the provider. Confirmed
  "Enabled" in the Supabase dashboard afterward.

**Known caveat:** the Google OAuth consent screen may still be in "Testing"
mode (only added test users can complete sign-in) unless published separately
- worth checking before relying on this for a real prospect. Also still
subject to the existing production gate: `/app` stays inert live until
`NEXT_PUBLIC_SUPABASE_*` etc. are set on Vercel.
- Also flagged while in the Supabase dashboard: the project's DB region reads
  **eu-west-1 (Ireland)**, not eu-central-1 (Frankfurt) as CLAUDE.md /
  SAAS_HANDOFF state - still EU, but the "stored in Frankfurt" marketing claim
  may need correcting.

## 4. Client self-test of the outreach — `done` (local), `needs Vercel env for prod`
The practice can **test the outreach on themselves**: receive the email or
WhatsApp message and walk through the patient's experience end to end (incl.
reply → booking) before sending to real patients.
- Depends on #6 (email) and #2 (WhatsApp) working. Medium.

**Done 2026-08-15, email side only** (WhatsApp is still #2, `todo`, so there is
no WhatsApp self-test yet; there is also still no in-product booking step for
anyone to test, real or synthetic, that is the separate, still-open calendar
-write-access item under "Guarantee mechanics" in CLAUDE.md — the testable
surface today is receiving the email, replying to it, and the unsubscribe
link).

- A **"Send me a test"** button on the campaign draft/review page
  (`src/app/app/campaigns/[id]/page.tsx`, new `test-send-form.tsx`, new
  `sendTestAction` in `campaigns/actions.ts`). Sends the exact composed
  message, same `renderTemplate`/`composeBody`/`emailProvider` code the real
  sender uses, to the signed-in user's own email, with the practice's real
  reply-to and a real working unsubscribe link. Only the subject gets a
  "[Test] " prefix so it is never mistaken for a genuine patient reply; the
  body is byte-for-byte what a patient would receive.
- New `src/lib/self-test.ts` (`ensureTestPatient`): one reusable synthetic
  patient per practice (upserted on a fixed `external_ref`, not a new row per
  test), flagged with a new `patients.is_test` boolean so it can ride the real
  send pipeline, which needs a real patient row to hang a `campaign_messages`
  row off, without being a real person. Reset to a clean active/consenting
  state on every test send, and any suppression left over from a previous
  test's unsubscribe click is cleared first, so testing the unsubscribe flow
  never permanently breaks the next test send.
- New migration `0008_self_test.sql` (`patients.is_test boolean not null
  default false`), applied to the live DB the same way as `0007`.
- Excluded `is_test` patients everywhere a practice looks at its own real
  numbers: `buildAudience` (so a real send can never write to it), dashboard
  stats, the patient list, CSV export, the dashboard's "most recent return"
  query, and the patient count on the data/privacy page's delete-everything
  card.
- New audit action `campaign.test_sent`.

**Verified 2026-08-15**, end-to-end in-browser against the real (live
Supabase) project: created a real draft campaign, sent a test, confirmed a
clean server log (a real Resend round-trip, no errors), confirmed dashboard
stats, the patient list and the CSV export were all unaffected by the
synthetic patient, confirmed the audit log entry. Pulled the real unsubscribe
token from the DB and used it for real: confirmed it named the practice
correctly, confirmed clicking through flipped the test patient to opted-out
and wrote a real suppression row, then sent another test and confirmed it
silently reset the test patient and cleared the suppression, so retesting
unsubscribe does not brick future tests. Deleted the throwaway draft campaign
afterward to restore the practice's campaign list to its pre-test state; kept
the synthetic test-patient row, since it is the feature's normal persistent
artifact rather than test contamination. tsc / lint / test (70/70) / build all
clean throughout.

**Still open:** same Vercel production gate as the rest of `/app`. WhatsApp
self-test waits on #2. Testing an actual reply → booking hand-off waits on the
booking/calendar-write-access work under "Guarantee mechanics" in CLAUDE.md,
which does not exist yet for real patients either.

## 5. Support chatbot for casdey itself — `done` (local)
A support chat widget bottom-right of the app (like most SaaS today), for the
**practice** to get help using casdey. Distinct from #2 (which talks to
patients).
- Standalone; medium.

**Done 2026-08-15, curated (not AI-backed).** Locked with Davide before
building: it answers from a fixed, hand-written set of questions a practice
actually asks, no LLM. Same standing-cost reasoning that retired #1's AI
drafting, a support bot would reintroduce exactly that per-use cost and the
`ANTHROPIC_API_KEY` dependency, for a job a good curated FAQ does better. If
it cannot answer, it falls back to a plain `mailto:info@casdey.com` (opens the
practice's own mail client, casdey never sends on their behalf).

- New `src/components/app/support-widget.tsx` (client) + `support-topics.ts`
  (the curated content, 10 topics: import, dormancy, sending a campaign, the
  self-test from #4, Free vs Premium, the guarantee, revenue estimate,
  recording a rebooking, unsubscribes, and data/GDPR). Answers are kept
  accurate to the actual product and written to the brand copy rules (no em
  dashes).
- Mounted once in `src/app/app/layout.tsx`, so it is on every `/app` page.
- New `IconHelp` (a chat bubble with a question mark, deliberately not
  `IconMessage`, which is the Campaigns glyph) and `IconClose` in
  `src/components/app/icons.tsx`.
- Design: the launcher is treated as chrome, sitting on the same inverted
  petrol plane as the sidebar, while the panel is a normal raised white card
  so its answers read like the rest of the product. Amber untouched. Uses only
  existing globals.css tokens, no new colours.
- Behaviour: bottom-right launcher toggles a panel; search does AND-matching
  across question + answer + keywords (so "delete data" narrows); topics are an
  accordion; a no-match state points at the email fallback. Escape and an
  outside click both close and return focus to the launcher; opening focuses
  the search. Reduced motion is handled globally.

**Verified 2026-08-15** in-browser at desktop and mobile (375px): launcher
renders on the petrol plane, panel opens, accordion expands, multi-word search
filters correctly, empty state shows, Escape closes and returns focus, the
panel fits the mobile viewport with no horizontal overflow, and there are no
app console errors (only dev HMR-socket noise). tsc / lint / test (70/70) /
build all clean. No schema or server data, so no migration.

**Still open:** same Vercel production gate as the rest of `/app` (the widget
itself needs no env vars, but `/app` is inert in prod until Auth/etc. are set).

## 6. Fix the send issue — `done` (local), `needs Vercel env for prod`
Campaign email used to send through casdey's own Zoho account, which can't
set a per-practice reply-to and trips Zoho's abuse limits (it's the same
account cold-outreach uses). Fix: wire up **Resend**.

**Done 2026-08-15:** the code side (`src/lib/messaging.ts`) was already built
in an earlier session and switches to Resend automatically once
`RESEND_API_KEY` is set - no code changes needed here, just the account/DNS
side:
- Created the Resend account (Davide, since account creation isn't something
  the agent does) and a sending domain **`mail.casdey.com`** - a subdomain,
  not the root `casdey.com`, so it doesn't touch Zoho's existing MX/SPF/DKIM
  records for the team's own mail. Region: Ireland (eu-west-1), matching the
  Supabase project.
- Added the 3 DNS records Resend required (1 TXT for DKIM, 1 MX + 1 TXT for
  SPF) directly in GoDaddy - verified existing Zoho records (`mx.zoho.eu`,
  `zmail._domainkey`, `_dmarc`, etc.) were untouched afterward.
- Domain verified within ~15 minutes of adding the records.
- Created a Resend API key (`casdey-web-production`, Sending-access-only, not
  Full access) and set `RESEND_API_KEY` + `CASDEY_SENDING_ADDRESS=no-reply@mail.casdey.com`
  in `web/.env.local`. Also documented both in `.env.example`.
- Verified locally: the "Replies will come to casdey rather than straight to
  you" warning on `/app/campaigns/new` (which only renders when the provider
  can't set a reply-to) is gone, confirming `emailProvider()` now picks
  Resend over Zoho.

**Still open:** add the same `RESEND_API_KEY` and `CASDEY_SENDING_ADDRESS` to
**Vercel** production env vars before this is live for real practices - not
done yet, deliberately, same reasoning as the rest of `/app` staying inert in
prod (see CLAUDE.md Infrastructure section). No real send has been tested end
-to-end yet (approving a campaign and letting it queue through Resend) - worth
doing once there's a safe test address to send to.
- No longer blocks #4 on the email side. #4 still needs #2 (WhatsApp) for
  full parity, but email self-test is unblocked now.

## 7. Practice price list + revenue in the dashboard — `in progress`
The practice's prices need to exist in the product, used for:
  (a) the messages sent (context/value), and
  (b) the **Overview dashboard**: alongside "how many patients rebooked," show
      **how much money they made**.

**Built 2026-08-14 — the revenue/dashboard half (b):**
- Migration `0004_pricing.sql`: adds `practices.appointment_value_minor`
  (nullable, minor units). **Not yet applied to the live DB** — see below.
- `src/lib/money.ts` (+ `money.test.ts`, 9 tests): currency per practice,
  money formatting, and `estimatedRecoveredMinor` = rebooked × value.
- Settings: a "What a returning patient is worth" card to set the value, with
  the practice's own currency symbol.
- Overview: an "Estimated revenue recovered" card (rebooked × value, labelled an
  estimate) when the value is set; a "Set appointment value" prompt when not.
- Verified: tsc / lint / test (59/59) / build all clean. Both dashboard render
  states confirmed in-browser. Save + revenue display is blocked only on the
  migration below.

**Migration applied 2026-08-14** to the live DB (via `pg` over the Supavisor
pooler). Full loop then verified in-browser: set £120 in settings → saved →
two test patients marked reactivated → dashboard showed "Estimated revenue
recovered £240". The revenue half of #7 is **done**.

Note found while connecting: the project's pooler answered on
`aws-1-eu-west-1` (Ireland), not eu-central-1 (Frankfurt) as CLAUDE.md /
SAAS_HANDOFF state. Still EU, so the residency promise holds, but the specific
"stored in Frankfurt" claim on the marketing data page may be wrong — worth
verifying the actual DB region in the Supabase dashboard.

**Also built 2026-08-14 — the service price list (half a's data):** at
Davide's call, the price list exists now as its own thing rather than waiting
for #1.
- Migration `0005_practice_services.sql` (applied to live DB, verified):
  `practice_services` table (name, price_minor, position), RLS member-select,
  writes via service role after an owner check.
- New Settings tab **Service prices** (`/app/settings/services`): add / edit /
  remove rows, each name + price in the practice's currency. Save upserts by id
  and deletes removed rows. Verified in-browser: added two services, saved,
  reloaded from DB, both persisted (Routine check-up £60, Scale and polish £75).
- `PracticeService` type added; `saveServices` action; `practice.services_updated`
  audit action.

**Still deferred to #1:** actually *weaving those prices into the message copy*.
The data and the settings UI exist now; the message composer that reads them is
#1's job. Feeds #8.

## 8. Make the profit-or-nothing guarantee actually work — `done` (local), `needs Vercel env + live Stripe for prod`
Two halves, both built 2026-08-15:

**(a) Eligibility / anti-abuse gating.** `src/lib/guarantee.ts` (pure, unit
tested, 11 tests) + `src/lib/guarantee-data.ts` (the DB queries that feed it).
Decisions locked with Davide before building:
  - **Threshold:** estimated revenue recovered (the same `estimatedRecoveredMinor`
    formula #7 already built) vs. what was actually paid to Stripe, both scoped
    to the guarantee window. Revenue ≥ paid is "met", short of it is "claimable".
  - **Window:** the practice's ONE lifetime guarantee window is the first
    campaign started on or after the first real (non-trial) Premium payment,
    run 30 days. Nothing during the free week counts. Because it is always the
    *first* qualifying campaign, a practice can never re-arm a second window,
    which is what makes (b) safe to be fully automatic.
  - **Refund scope:** everything paid during that one window, not a single
    invoice and not open-ended — confirmed explicitly with Davide.

**(b) Refund mechanism.** `POST /api/guarantee/claim` — fully self-service,
no human review: recomputes eligibility server-side from the database (never
trusts the browser), then calls Stripe `refunds.create` directly. Safe to be
automatic because of the one-lifetime-window guarantee above, and because
`guarantee_claims.practice_id` is UNIQUE, which also doubles as the race guard
against a doubled click.

**New schema (migration `0007_guarantee.sql`, applied to the live DB):**
  - `practices.premium_started_at` — set once by a new `invoice.paid` Stripe
    webhook handler (never overwritten), which also writes `subscription_payments`
    (one row per paid invoice, with whichever of `stripe_payment_intent_id` /
    `stripe_charge_id` Stripe actually settled it against — the refund target).
  - `guarantee_claims` — one row per claim (at most one per practice), records
    the window, the figures, the Stripe refund id(s), and status
    (`processing`/`refunded`/`failed`).

**UI:** a "The profit-or-nothing guarantee" card on `/app/settings/billing`,
above the upgrade path, showing not-started / running (with live so-far
figures) / met / claimable (+ a two-step "Claim your refund" button,
`guarantee-claim-form.tsx`) / claimed (refunded, or failed-and-being-sorted-out).

**Verified 2026-08-15:** tsc / lint / test (70/70, 11 new) / build all clean.
End-to-end in-browser against the real (local) Supabase project: temporarily
back-dated a real practice's `premium_started_at` and a real campaign's
`started_at` to exercise "running" then "claimable", clicked through the arm
→ confirm → submit flow for real against the claim route, watched it
correctly reject a deliberately-fake `payment_intent` id (Stripe test mode,
so nothing could actually move), confirmed the failure path’s claim record,
audit log entry, and "claimed" UI branch all matched, then deleted every row
the test touched and restored the practice to its original state. No real
Stripe payment/refund exists yet to test the success path against — that
needs a real test-mode subscription actually running through the app.

**Still open:**
- Same as #6/#3: Vercel production env still deliberately lacks Stripe/Auth
  vars, so this is inert in production until that gate lifts.
- Never exercised the success path (a real refund actually completing) since
  there is no live subscription to test against yet. Worth doing once a real
  test-mode Premium subscription exists.
- Whether the subscription itself should be cancelled automatically when a
  guarantee refund fires, or left running for the practice to cancel
  themselves — not asked, so left running (belt-and-braces: they can always
  cancel from "Manage billing"). Revisit if it causes confusion in practice.

---

## Suggested sequencing (not locked)
1. ~~**#6 send fix**~~ — done (local) 2026-08-15, unblocks email-side #4. Needs
   `RESEND_API_KEY` on Vercel before it's live for real practices.
2. ~~**#3 Google login**~~ — done 2026-08-15.
3. ~~**#7 price list + revenue**~~ — done 2026-08-14, foundation the guarantee (#8) needs.
4. ~~**#8 guarantee**~~ — refund + eligibility gating, done (local) 2026-08-15.
5. ~~**#1 AI message + language**~~ — reverted 2026-08-15 (language kept, AI dropped).
6. ~~**#4 self-test**~~ — email side done (local) 2026-08-15; WhatsApp side still
   waits on #2.
7. ~~**#5 support chatbot**~~ — curated (not AI), done (local) 2026-08-15.
8. **#2 WhatsApp AI agent** — last one standing; the big one, needs a WhatsApp
   Business API provider and an AI reply loop.

Status: **done** — #1 (language only), #3, #4 (local, email only), #5 (local),
#6 (local), #7, #8 (local). **todo** — #2.

## Open questions to pin down as we go
- #2: which AI model/provider for the WhatsApp agent, and which WhatsApp
  Business API provider.
- #7: where do prices come from — manual entry, or read from practice software?
  (Answered for now: manual entry via Settings → Service prices.)
