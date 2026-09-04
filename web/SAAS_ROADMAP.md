# casdey SaaS — fixes & features roadmap

> **The authoritative path to a ready V1 is now `SAAS_V1_PLAN.md`.** It merges
> this roadmap's still-open items (#9 deferred, #10) with the onboarding
> readiness gates and the ops tasks into one sequenced plan. Read that first.
> This file is kept for the item-by-item build history below.

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

## 2. WhatsApp channel with a responsive AI agent — `done` (local), `needs Twilio/Meta setup + Vercel env for prod`
Add WhatsApp as a contact channel alongside email. Here the AI must be
**responsive and personalized**, behaving like a chatbot: it holds a real
back-and-forth with the patient, not a single templated send.
- Touches: WhatsApp Business API (provider TBD, e.g. Twilio/360dialog), inbound
  webhook, conversation state, AI reply loop, booking hand-off.
- Big; standalone channel work. Depends on send infra being solid (#6).

**Done 2026-08-15.** Decisions locked with Davide before building: Twilio
(his call, "recommend one"), Claude Haiku for the AI reply loop (a real
per-use cost accepted deliberately, unlike #1's dropped AI drafting, because
a live conversation cannot be pre-templated), one shared casdey WhatsApp
number for every practice (mirrors the shared `mail.casdey.com` email
domain, not a number per practice), and a full build in one pass rather than
foundation-then-AI in two sessions.

- **Schema** (`supabase/migrations/0009_whatsapp_channel.sql`, applied to the
  live project): widened `campaigns.channel` to allow `'whatsapp'`, added
  `patients.consent_whatsapp`, `practices.whatsapp_enabled` /
  `whatsapp_template_name`, and four new tables —
  `whatsapp_conversations` (one thread per patient), `whatsapp_messages`
  (every inbound/outbound message), `whatsapp_suppressions` (the WhatsApp
  do-not-contact list, phone-keyed), `whatsapp_events` (inbound-webhook
  idempotency, mirrors `stripe_events`). `campaigns.subject`/`body` are now
  nullable with a check constraint requiring the right fields per channel;
  `campaigns.whatsapp_template_name` freezes the template used, same
  reasoning as the `audience` snapshot.
- **Twilio integration** (`src/lib/whatsapp/`): `twilio.ts` sends via raw
  fetch (no SDK, matching how Resend is called), `signature.ts` implements
  Twilio's request-signing algorithm kept free of `"server-only"` so it is
  unit tested directly (`signature.test.ts`, 7 cases), `send.ts` is the
  provider abstraction (`whatsappProvider()`, template vs freeform send,
  falls back to a "disabled" stub when unconfigured, same pattern as
  `emailProvider()`).
- **Audience + campaigns**: `buildAudience()` in `src/lib/campaigns.ts` takes
  a `channel` argument and filters on `consent_whatsapp`/`phone` instead of
  email's fields. WhatsApp campaigns skip the email drip queue entirely —
  `src/lib/whatsapp/campaign-send.ts` sends the whole batch of template
  messages synchronously on approval (a dormant list's volume does not need
  email's day-offset pacing, and a template send is a one-shot opener, not a
  resend-with-backoff shape). The campaign UI
  (`src/app/app/campaigns/new/form.tsx`) gained a channel selector that
  swaps the whole email-specific editor for a read-only template summary,
  since Meta requires exact pre-approved wording for first contact.
- **Inbound webhook** (`src/app/api/whatsapp/webhook/route.ts`): same three
  rules as the Stripe webhook (signature verification, idempotency via
  `whatsapp_events`, never 500 on our own errors). Routes an inbound message
  to the most recently active conversation for that phone number (documented
  edge case: the shared number means two different practices' patients
  sharing one real phone number would collide — accepted at current scale).
  STOP-style keywords are handled here directly, not by the AI, mirroring
  email's unsubscribe link: suppression, patient status, conversation status,
  and the audit log all update before any model is called.
- **AI reply loop** (`src/lib/whatsapp/ai-agent.ts`): raw fetch to the
  Anthropic Messages API (Claude Haiku), a system prompt scoped to
  re-engagement only (no clinical advice, no invented appointment times), and
  one tool (`mark_booking_requested`) the model calls on clear booking
  intent. Two cost/runaway guardrails: conversation history sent to the
  model is capped, and each conversation gets a hard cap on total AI replies
  (`WHATSAPP_AI_MAX_TURNS`, persisted on `whatsapp_conversations` so it
  survives across webhook calls) past which the conversation closes and a
  human takes over.
- **Hand-off**: no new booking/calendar infrastructure needed. A
  `booking_requested` conversation shows a transcript and a banner on the
  patient page (`src/app/app/patients/[id]/whatsapp-conversation.tsx`) right
  next to the **existing** "Mark as rebooked" button
  (`src/app/app/patients/[id]/actions.ts`, unchanged) — the same manual,
  staff-confirmed write the guarantee's revenue calculation already keys off.
- **Settings** (`src/app/app/settings/whatsapp/`): an on/off toggle per
  practice and a field for the approved template's Twilio Content SID,
  following the same page/form/actions shape as Settings → Service prices.
- **Self-test**: `ensureTestWhatsAppPatient()` in `src/lib/self-test.ts`
  mirrors the email self-test's synthetic-patient pattern with its own fixed
  `external_ref`. A "Send me a test" form on the WhatsApp campaign review
  page sends the real approved template to a phone number the practice
  types, and replying to it rides the exact same webhook → AI loop →
  hand-off path a real patient's reply would.
- Verified: `tsc`/`lint`/`test`/`next build` all clean throughout
  (`signature.test.ts` added, 7/7 passing).

**E2E test attempted 2026-08-15, blocked by Twilio trial limits (not a code
bug).** Davide created the Twilio account (free trial, no card) and joined
the WhatsApp Sandbox from his own phone. Set up a local e2e test: real
`ANTHROPIC_API_KEY` created (new "casdey" Anthropic Console org), dev server
+ a cloudflared quick tunnel for the inbound webhook's public URL. Found:
  - The Sandbox's **Sandbox settings** page (where the inbound webhook URL is
    configured) crashes with a client-side error and bounces to Twilio's
    "Upgrade your account" screen — reproduced 5+ times across fresh tabs and
    URL paths, so this reads as Twilio gating custom webhook config behind an
    upgraded (payment-method-on-file) account, not a transient bug.
  - The **Content Template API** is explicitly blocked on trial: `GET
    /v1/Content` returns `20003 "This feature is not available on a Trial
    account."` Since `sendWhatsAppMessage`'s template path
    (`src/lib/whatsapp/twilio.ts`) needs a Content SID, and the freeform path
    also got rejected with `21654 "ContentSid Required"` even inside a fresh
    24h session window (confirmed via the Messages API log: a "join
    twilio-trial" and its auto-reply, both delivered/read), **no outbound
    send succeeds through our own code on this trial account at all** —
    template or freeform.
  - Confirmed via Twilio's own "Try out WhatsApp" console widget (not our
    code) that the Sandbox number itself is alive and reachable (2 join
    events + 2 auto-replies, both "Read") — so this is specifically an
    API/account-tier limitation, not a dead sandbox.
  - Local env now has a real `ANTHROPIC_API_KEY` (`web/.env.local`, org
    "casdey", $0 credits — needs funds added before real use).

**Free local integration test, same day, after Davide flagged that
upgrading Twilio has a real upfront cost (a forced balance top-up, not just
a card on file) and asked whether that was actually the best next step.**
Decided to hold off on Twilio spend and instead derisk everything on our
side of the Twilio boundary for $0: crafted a correctly-signed fake Twilio
webhook POST (reproducing `verifyTwilioSignature`'s exact HMAC algorithm) and
sent it straight to the local `/api/whatsapp/webhook`, using a synthetic
patient/conversation on the existing `test@casdey.com` practice with a
clearly-fake phone number — no real Twilio traffic at all. Confirmed working
end-to-end:
  - Signature verification, idempotency, conversation lookup by phone all
    correct.
  - Inbound message correctly persisted to `whatsapp_messages`.
  - The AI reply path is correctly reached and calls the real Claude API —
    caught and fixed a **real bug in the process**: the first
    `ANTHROPIC_API_KEY` was subtly mistyped (an `O`/`0` misread from a
    screenshot), so the first test correctly surfaced `401 invalid API key`.
    Recreated the key and read it back via the OS clipboard instead of
    visual transcription; the retest then got a clean `400 credit balance
    too low` (the org has $0 credits — an orthogonal, expected block, not a
    bug) — proving the request reaches Anthropic correctly and fails only on
    funding.
  - The STOP opt-out path (no AI call involved) verified fully: conversation
    → `opted_out`, a `whatsapp_suppressions` row created, patient →
    `opted_out`, all in one webhook call.
  - All synthetic test data (patient, conversation, messages, suppression)
    deleted afterward; `practices.whatsapp_enabled` reverted to its prior
    `false`. No residue left in the live Supabase project.

Net effect: everything on casdey's side of the Twilio boundary (webhook
security, conversation state, AI call, opt-out) is now verified correct, at
zero cost. What's left unverified is exactly the Twilio send step itself
(outbound template/freeform message actually reaching a phone), which
remains blocked on the trial-account limits above until Davide chooses to
upgrade Twilio (or registers a production sender).

**Still open, not solvable in code:** production sending needs Davide to add
a payment method to the Twilio trial account (unlocks Content Templates and
the Sandbox settings custom-webhook page — still free unless usage exceeds
trial credit) and/or request WhatsApp Business API access, complete Meta
Business verification for the casdey WhatsApp sender, and get at least one
message template approved by Meta (review can take hours to a few days).
Same production gate as the rest of `/app`: inert until `TWILIO_*` and
`ANTHROPIC_API_KEY` are set on Vercel, deliberately not done yet. WhatsApp
self-test riding #4 remains blocked on the same Twilio account-tier issue,
not on the self-test code itself; the still-open half of #4 (an in-product
booking step to test reply → booking end to end) remains open too, unrelated
to WhatsApp specifically.

**Timing decision, 2026-08-15:** Davide is deliberately deferring the Twilio
upgrade (the payment-method top-up above) until he decides to publish V1.
Until then, WhatsApp stays exactly where the free local test left it:
everything on casdey's side of the Twilio boundary verified working, actual
outbound sending (and therefore #4's WhatsApp half) still blocked on the
trial account. No further Twilio work is expected in the meantime; revisit
this item when the V1-publish decision is made, not before.

**Real bug found and fixed 2026-08-16**, independent of the Twilio
trial-account limits above: nothing anywhere in the pipeline converted a
patient's phone number to the E.164 format Twilio's API requires. A
practice's CSV export writes local format (`07700 900123`, the UK default,
not `+447700900123`), which broke two things at once — Twilio rejects a
non-E.164 `to` (confirmed via a real API call: a malformed-format number gets
a different error code than a legitimately-restricted one), and the inbound
webhook matches a reply back to its conversation by exact stored phone
string, so even a send that somehow succeeded would never route a reply back
correctly. Fixed by adding `libphonenumber-js` and normalising to E.164 at
CSV import time (`src/lib/ingestion/csv.ts`, `normalizePhoneForCountry`),
using the practice's own country as the default region; falls back to the
raw value if a number cannot be read at all, rather than blocking the import
row. Verified live: imported a UK-local-format number, confirmed it stored
as E.164, then sent a real signed webhook reply and confirmed it routed to
the correct conversation. This means the trial-account limits above were not
the only thing standing between WhatsApp and actually working for a real UK
or EU practice — this bug would have broken it regardless, once Twilio
access was upgraded.

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
- still unchecked as of 2026-08-17, worth confirming before relying on this
for a real prospect. `NEXT_PUBLIC_SUPABASE_*` and the rest of `/app`'s env
vars are now set on Vercel (2026-08-17), but production hasn't been
redeployed with them yet — see `SAAS_HANDOFF.md`.
- Also flagged while in the Supabase dashboard: the project's DB region reads
  **eu-west-1 (Ireland)**, not eu-central-1 (Frankfurt) as CLAUDE.md /
  SAAS_HANDOFF state - still EU, but the "stored in Frankfurt" marketing claim
  may need correcting.

## 4. Client self-test of the outreach — `done` (local), `needs Vercel env for prod`
The practice can **test the outreach on themselves**: receive the email or
WhatsApp message and walk through the patient's experience end to end (incl.
reply → booking) before sending to real patients.
- Depends on #6 (email) and #2 (WhatsApp) working. Medium.

**Done 2026-08-15, email side only.** WhatsApp self-test was added when #2
shipped later the same day (`ensureTestWhatsAppPatient` in `src/lib/self-test.ts`,
the "Send me a test" form on a WhatsApp campaign's review page) — see #2 below
for detail. The booking/calendar loop (built 2026-08-15, Google Calendar
wired 2026-08-16, see `CLAUDE.md` Stage 2 progress and `SAAS_HANDOFF.md`)
means a reply → booking hand-off can now be tested for real too, via the
patient's self-serve booking link.

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

**Real bug found and fixed 2026-08-16:** the campaign review page's
Sent/Queued/Not-delivered stats counted a self-test send's own
`campaign_messages` row alongside the real audience — the `is_test`
exclusion list above never covered this particular query. A campaign with a
3-patient real audience showed "Sent 1 / Queued 3" after a self-test, instead
of "Sent 0 / Queued 3". Fixed in `src/app/app/campaigns/[id]/page.tsx` by
joining to `patients` and filtering `is_test = false`, matching the pattern
`buildAudience` already used.

**Still open:** same Vercel production gate as the rest of `/app`.

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

**Live:** same Vercel state as the rest of `/app` (the widget itself needs no
env vars; `/app`'s env vars were set 2026-08-17 and production has been
redeployed — see `SAAS_HANDOFF.md`).

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

**Still open:** `RESEND_API_KEY` and `CASDEY_SENDING_ADDRESS` were added to
**Vercel** production env vars on 2026-08-17 (see CLAUDE.md Infrastructure
section) and production has been redeployed, but no real send has
been tested end-to-end in production yet (approving a campaign and letting it
queue through Resend) - worth doing once there's a safe test address to send
to.
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

**Success path finally exercised 2026-08-16, and it did not work — found and
fixed two real bugs.** Signed up as a fresh practice, ran a real Stripe
Checkout (test-mode card) to Premium, approved a campaign, then backdated the
practice's timestamps 30+ days to make the window read as closed, and clicked
"Claim your refund" for real. It failed both times, for two independent
reasons:
  - `loadGuaranteeStatus` (`src/lib/guarantee-data.ts`) and the claim route
    both used the qualifying campaign's `started_at` as the lower bound for
    "payments in the window" — but the payment that unlocks Premium always
    happens *before* the practice gets around to approving a campaign, so
    that first payment was excluded from "paid" every time. The billing page
    showed "£0 paid" against a real £200 charge. Fixed to use
    `practice.premium_started_at` instead (safe because it is set once and
    never touched again, so it can never pull in a second, unrelated billing
    period).
  - Separately, the `invoice.paid` Stripe webhook handler fetched the invoice
    without `expand: ["payments"]`. Confirmed against a real invoice: without
    that expand, Stripe's REST API omits the payments list entirely, so
    `stripe_payment_intent_id` and `stripe_charge_id` were **always null** on
    every `subscription_payments` row ever written — meaning even after
    fixing the bug above, the claim route logged "payment has no refundable
    target" and refused to refund anything. Fixed by adding the expand.

  Together these meant the guarantee's refund had been completely
  non-functional since it was built, for every practice, silently — a
  claim would record as "failed" and burn the practice's one lifetime slot
  with nothing refunded. Both fixed and **re-verified with a real Stripe
  test-mode refund that completed successfully** (`status: succeeded`) via
  the actual claim route.

**Still open:**
- Vercel production got its Stripe/Auth vars on 2026-08-17 (including live-mode
  Stripe prices/coupons/webhook, see `SAAS_HANDOFF.md`) and production has since
  been redeployed, so the guarantee path is live in prod. Still worth a real
  live-mode (not test-mode) checkout + refund end-to-end before relying on it,
  and the #9 hardening (needs_review + bounded paid window) shipped 2026-08-17.
- Whether the subscription itself should be cancelled automatically when a
  guarantee refund fires, or left running for the practice to cancel
  themselves — not asked, so left running (belt-and-braces: they can always
  cancel from "Manage billing"). Revisit if it causes confusion in practice.

---

## 9. Pre-launch stress-test audit — `fixes shipped 2026-08-17` / `deferred items open`

An 8-agent read-only adversarial audit (one specialist per domain) ahead of the
V1 go-live. Core engineering held up: no auth bypass, RLS on all 19 tables,
`tsc`/`lint`/`test`/`build` all green. Risk was concentrated in production
config, silent-failure handling on external APIs, the legal documents, and the
guarantee's economics.

**Shipped in commit `f30f61b` (deployed 2026-08-17), all code-only, no migration:**
- **Import batch-poisoning** — a single shared/duplicate email in a CSV used to
  fail the whole `ON CONFLICT` batch and silently drop up to 500 rows. Now
  `upsertPatients` dedups on the conflict key and, on a batch error, retries the
  slice row-by-row so one bad record is isolated and reported (surfaced in the
  import `issues`) instead of lost. `src/lib/ingestion/upsert.ts`.
- **Import encoding + parse errors** — decode strict UTF-8 then fall back to
  Windows-1252 (+ BOM strip) so accented UK/EU names no longer import as
  mojibake, and Papa parse errors are surfaced instead of trusted.
  `src/app/api/import/route.ts`.
- **Guarantee hardening** — an unset appointment value can no longer auto-qualify
  a full-window refund: a shortfall with no trustworthy revenue basis resolves to
  a new `needs_review` state (routed to us) rather than a one-click `claimable`.
  And the paid/refunded set is bounded to the window's billing period via a shared
  `paymentsFundingWindow()` helper, applied to both the display and the claim
  route, so an extra pre-window month is no longer over-refunded. `src/lib/
  guarantee.ts`, `guarantee-data.ts`, `src/app/api/guarantee/claim/route.ts`.
- **Password reset** — there was no recovery flow at all. Added a "Forgot
  password?" request in the auth form, a top-level `/reset-password` page, and a
  server-side `/api/auth/reset-password` handler (server-side deliberately: the
  session cookie is HttpOnly). Relies on custom SMTP → Resend being configured.
- **Cron double-send** — `drainQueue` now atomically claims each row (leases
  `send_after` into the future under a `.lte(send_after, now)` guard) before
  sending, so two overlapping drains can't email the same patient twice.
  `src/lib/sender.ts`.
- **Config guards** — `siteUrl()` throws in production instead of silently
  returning `localhost:3000` (it feeds unsubscribe/booking links and the Twilio
  webhook signature); the Supabase clients reject a URL carrying a `/rest/v1`
  suffix (the recurring incident). `src/lib/messaging.ts`, `supabase-*.ts`.
- **Copy** — Google Calendar event titles use "with", not an em dash.

**Deferred — must land before enabling the gated channels:**
- **Calendar (before turning Google-calendar sync on for real):** free/busy
  currently fails *open* — any error reading the practice's calendar is caught and
  treated as "no busy times", so a genuinely-busy slot shows as open and gets
  double-booked; fail closed instead. Confirm/publish the Google OAuth consent
  screen (an unverified/Testing app expires refresh tokens after 7 days, so a
  connected calendar silently goes dark ~a week later) and surface a re-auth
  banner on `invalid_grant`. Narrow the requested scope from `calendar.events`
  (edit/delete *all* the owner's events) to `calendar.app.created`. Enforce buffer
  minutes under concurrency, and reconcile/retry Google-mirror desyncs.
- **WhatsApp (before turning the AI reply loop on):** the first Claude call is
  malformed (history starts on the seeded outbound template, so the `messages`
  array opens on `assistant` and the API 400s — the loop may never have produced a
  real reply); the reply-cap + booking-status update is a non-atomic read-then-
  write race; history loads the *oldest* 40 messages not the newest; STOP opt-out
  is exact-match English-only (misses "Please STOP" and every non-English variant
  in the target market); and there's no output moderation before an AI message
  sends under the practice's name (prompt-injection → fabricated "free treatment"
  promise).
- **GDPR documents (before opening `/app` to real practices):** the signed DPA
  (`src/app/terms/processing/page.tsx`) states patient data "is not transferred
  outside the UK or EEA" and lists only Supabase/Vercel/Stripe/Zoho-Resend, but
  patient PII actually reaches Google (calendar, live), Twilio and Anthropic in the
  US — undisclosed (Art. 28 + Art. 44). `/privacy` still asserts "casdey does not
  hold any patient data yet" (false at launch) and has unfilled controller
  legal-identity + postal-address TODOs. Cleanest fix is to ship email-only first
  and only claim what casdey actually does.

## 10. Win-back offer / comeback incentive — `todo` (idea captured 2026-09-01, not started)
Davide's idea, dictated 2026-09-01. The worry behind it: **just reminding a
lapsed or cancelled member may not be enough to get them back** — reactivation
often needs an *incentive*, not only a nudge. His own example: after he
cancelled Spotify, they won him back with a strong discounted comeback offer.
Gyms and studios should be doing the same to their ex-members, and casdey
should **help them build and present that offer**, as the thing that actually
converts the win-back campaign this product already sends.

**Hard constraint from Davide:** *not* a static "here's a PDF guide on how to
write an offer". He wants an **interactive experience**, something the member
actually engages with, not a document the gym reads.

**Not yet scoped — open design questions for when we build it:**
- What the member sees: likely a personalized comeback landing page per member
  (casdey already has member-facing surfaces: the self-serve booking link
  `/book/[token]` and the unsubscribe page `/u/[token]`), carrying the gym's
  offer and a one-tap way to claim it + book. The "interactive" part lives here.
- What the gym configures: the offer itself (e.g. a discounted month, a free
  week back, a waived join fee). Ties to the existing per-gym price list (#7)
  and membership tiers. The gym decides the incentive; casdey frames/presents it.
- How it threads into what exists: it should extend the **win-back campaign
  kind** and `{{...}}` templating already built (an offer placeholder / offer
  link), and hand off into the **booking loop** so claiming the offer and
  booking are one flow, not two.
- Whether it can reference the **cancellation reason** already captured
  (`{{reason}}`) to tailor the offer (e.g. a price-sensitive leaver gets the
  discount framing) — likely yes, and a natural fit.
- Redemption mechanics: does casdey just *present* the offer and record intent,
  or actually apply/track a discount? Leaning "present + record" first, given
  casdey doesn't run the gym's own membership billing. To decide when we build.
- Keep the standing-cost lesson in mind (#1, #5): reach for a configurable,
  non-AI interactive flow first rather than a per-use LLM feature, unless a
  live conversation is genuinely needed.

**Status: idea only.** Not started, no schema, no UI. Build when Davide says go.

## Suggested sequencing (not locked)
1. ~~**#6 send fix**~~ — done (local) 2026-08-15, unblocks email-side #4. Needs
   `RESEND_API_KEY` on Vercel before it's live for real practices.
2. ~~**#3 Google login**~~ — done 2026-08-15.
3. ~~**#7 price list + revenue**~~ — done 2026-08-14, foundation the guarantee (#8) needs.
4. ~~**#8 guarantee**~~ — refund + eligibility gating, done (local) 2026-08-15.
5. ~~**#1 AI message + language**~~ — reverted 2026-08-15 (language kept, AI dropped).
6. ~~**#4 self-test**~~ — email side done (local) 2026-08-15; WhatsApp side done
   the same day when #2 shipped.
7. ~~**#5 support chatbot**~~ — curated (not AI), done (local) 2026-08-15.
8. ~~**#2 WhatsApp AI agent**~~ — the big one, done (local) 2026-08-15: Twilio,
   Claude Haiku, one shared number. Needs Twilio/Meta setup + Vercel env to go
   live for real.

Status: **done** — #1 (language only), #2 (local), #3, #4 (local, both
channels), #5 (local), #6 (local), #7, #8 (local). Every item on this list has
shipped at least locally; what remains is external setup rather than more
building — Vercel got its core env vars 2026-08-17 and production was redeployed,
so `/app`'s email + billing paths now serve at casdey.com. What remains: the
Google OAuth consent screen is still in Testing (needs publish + verification),
the Calendar-sync and WhatsApp env vars are deliberately still absent from Vercel
(so those channels are inert in prod), the #9 deferred items above must land
before those channels are switched on, and #2's Twilio/Meta approval is still
pending — see each item for its specific gate.

**Superseded 2026-09-03/04 (this doc is pre-pivot history; `SAAS_V1_PLAN.md` and
`SAAS_HANDOFF.md` are current).** Of the gates listed above: the consent screen
is **published to production** with **no verification review required** (B1), the
Calendar env vars **are** in Vercel (B2), and the deferred #9 items have landed.
Still genuinely open: the Twilio account upgrade (B8) that gates WhatsApp
sending, and the 3-tier Stripe prices/coupon (F2).

## Open questions to pin down as we go
- #2: **answered** — Twilio for the WhatsApp Business API provider, Claude
  Haiku for the AI reply loop, one shared casdey number for every practice.
- #7: where do prices come from — manual entry, or read from practice software?
  (Answered for now: manual entry via Settings → Service prices.)
