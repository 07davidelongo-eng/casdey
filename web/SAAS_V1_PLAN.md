# casdey — the V1-ready plan (single source of truth)

The one complete, sequenced plan for getting the gym SaaS to a **ready V1**.
Merges and supersedes the scattered "before V1" material: `SAAS_ROADMAP.md`'s
leftover items (#9 deferred, #10) and its "Suggested sequencing", the readiness
gates + playbook in `SAAS_ONBOARDING.md`, and the ops/external tasks recorded
across `CLAUDE.md`. When those docs and this one disagree on what's left for
V1, **this doc wins**. Written 2026-09-03.

Status key: `todo` / `in progress` / `done` / `blocked`. Owner: **me** (code) or
**Davide** (external accounts, dashboards, business decisions, the final
walkthrough).

---

## 0. What "V1 ready" means — the definition of done

An engaged lead from outreach is sent a signup link and, **with zero hands-on
help from Davide**, gets all the way through:

> sign up → import member CSV → see lapsed members → set membership prices →
> connect Google Calendar → review + approve a win-back campaign → watch replies
> and bookings land on the dashboard → upgrade to Premium after the free week.

V1 is ready only when **all** of these hold:

1. Every step above works **in production**, not just locally.
2. A non-technical gym owner can complete it **unattended** (guided, forgiving,
   good empty/error states, self-serve help).
3. The **legal documents are accurate** for what casdey actually does as a gym
   product (sub-processors, controller identity, data claims).
4. Nothing **silently dies later** (Calendar tokens, double-booking, double-send).
5. **Davide's own end-to-end walkthrough passes** — this is the final
   acceptance gate (Track D), done **only after Tracks A, B and C are all
   green**. Not before, per Davide's explicit instruction.

**Rescoped INTO V1 — 2026-09-03, Davide's call after re-reviewing JD's asks.**
JD's cold-outreach feature list is now a V1 target, not V2. Two of the four
items already shipped (at-risk campaigns, cancellation reasons — commit
`88ff34f`). The remaining two become **Track E**:
- **E1. WhatsApp channel revival** — firm V1 addition. Revive the built-then-
  deleted WhatsApp + AI-reply-loop code, adapt it to the gym model, fix the 5
  known audit bugs. External blocker: Davide must upgrade the Twilio account
  (trial gates outbound). Channel choice confirmed **WhatsApp** (not SMS).
- **E2. Direct gym-software API sync** — **best-effort V1**. Attempt it; **drop
  back to V2 if the partner-API access wall makes it too complex** for the V1
  timeline (each vendor — Mindbody / Glofox / LegitFit / whatever JD runs —
  needs its own developer/partner approval, which is outside our control).

**Still explicitly NOT in V1** (deferred to V2, do not let these expand scope):
the #10 win-back/comeback-offer interactive page, republishing the public
marketing homepage (invited-only signup does not need it).

**Parked future direction — Davide's stated intent, 2026-09-03 (NOT V1; do not
start until D passes, recorded so it isn't lost):**
- **Brand identity refresh** — a new colour palette, fonts and logo, superseding
  the v3 "Iron & Brass" system (`brand assets/casdey-brand-guide.html` +
  `web/src/app/globals.css` tokens). A deliberate re-do of the visual identity,
  not a tweak.
- **Three plan tiers: Free / Standard / Pro** — replacing today's Free vs
  Premium in `web/src/lib/plan.ts` (aligns with the earlier go-to-market note's
  Free/Starter/Pro idea). Needs pricing + capability scoping per tier and
  matching Stripe products/prices before it can ship.

---

## 1. Where things actually stand (2026-09-03)

- The **dental→gym pivot shipped and deployed** (commit `25af6aa` + ~12 after
  it on `main`; Vercel auto-deploys). Not "local only" as `SAAS_ROADMAP.md` /
  `SAAS_HANDOFF.md` still say.
- `/app`, `/login`, `/book/*`, `/u/*`, `/terms/*`, `/privacy` are **reachable in
  production** (invited-only; the marketing homepage `/` still redirects to
  `/waitlist`). Email + billing env vars are set in Vercel; **calendar env vars
  too, as of 2026-09-03 (B2 done)** — booking reads/writes Google in prod.
- **Outreach is live** (gym, 75 email/day + IG drafts) and producing engaged
  leads — they currently have nowhere polished to land. This is what makes V1
  urgent.
- Migrations exist through `0013`. **`0011`/`0012`/`0013` are all confirmed
  applied to the live DB (B3 done, 2026-09-03).**
- Post-pivot build already shipped on top: guarantee ledger + undo-return,
  at-risk campaigns, cancellation reasons + `{{reason}}` templating, Free-plan
  member-list cap (5 rows), partial legal-doc fixes, apex-domain auth-link fix.
- **The last full end-to-end walk of the customer flow was pre-pivot
  (2026-08-16).** Nothing has been verified end to end since the rebuild. A1
  fixes that.
- Onboarding today = a 2-step form (`/app/onboarding`: gym name / country /
  emails, then import). After that the user is dropped on the dashboard and has
  to *discover* Settings → Services (prices), Settings → Booking (calendar), and
  Campaigns → New on their own. That gap is A2.

---

## 2. TRACK A — build (me)

Do in this order. A2–A5 are the core of V1 and can partly overlap.

### A1. Discovery / ground-truth pass — `code-side done 2026-09-03; prod walk → Track C`
Deliverable: a written defect list that makes the rest of Track A estimable.
- **Done (code-side):** `tsc` / `lint` / `test` (120) / `build` all green on
  `main` — no compile-level rot from the pivot. Audited the post-signup flow:
  onboarding is a 2-step form; the import wizard (`import-wizard.tsx`) is
  already solid (browser preview, column auto-guess + manual map, date-format
  picker, per-row skip reasons), so **A3 is polish + real-export testing, not a
  rebuild**. Found the core gap A2 fixes: after import the flow becomes
  discovery-by-nudge-card, and two of five steps (booking value, calendar) had
  **nothing** pointing at them.
- **Moved to Track C:** the fresh-signup walk *in production* needs a new
  account + email confirmation + password (Davide's to do, and we're saving his
  fresh eyes for Track D), so it's folded into C4 rather than done now. Build
  verifies against local dev as we go.
- **Still owed to Davide:** cross-check Vercel env vars (feeds B-track).
  Migration state (B3) and Vercel plan (B5) now both confirmed.

### A2. Guided first-run setup checklist — `done (local, verified) 2026-09-03`
Turned the scattered setup into **one walked path** the owner cannot get lost
in. Chosen shape: a **persistent setup checklist that leads the dashboard**
until setup is done (lighter than a forced full-screen wizard, and it survives
the owner leaving and coming back). Wraps the existing pages rather than
rebuilding them, so it's additive and low-risk.
- `src/lib/setup.ts` — `buildSetupState()`, a pure function that derives all
  five steps (import → check lapse window → set booking value → connect calendar
  → approve first campaign) **entirely from existing DB state**, so there's no
  flag to persist and **no migration**. The panel disappears on its own once
  every countable required step is done.
- `src/components/app/setup-checklist.tsx` — presentational render: progress bar
  + "N of 5 done", teal check markers, brass CTA per pending step. Calendar is
  marked **optional** (booking works without it) and shows as **unavailable**
  (greyed, uncounted) when the server has no calendar wired up — which is prod's
  current state until B2.
- Wired into `src/app/app/page.tsx` for both the empty (`members === 0`) and
  populated dashboard branches; hidden entirely when `setup.complete`.
- `src/lib/setup.test.ts` — 6 unit tests. Full suite now **126/126**; tsc /
  lint / build green.
- **Verified in-browser (local dev)** at desktop and mobile 375px against the
  live test gym: complete-state correctly hides the checklist; a forced
  partial state renders all five rows correctly with the gym's own lapse rule
  in the copy; fixed a mobile bug where the CTA squeezed the text column (button
  now stacks below on narrow screens).

### A3. CSV import hardening — `code-side done 2026-09-03; real-file test → B4/C`
The parser was already robust (strict-UTF-8→Windows-1252 decode + BOM strip,
surfaced Papa parse errors, row-by-row retry so one bad row can't poison a
batch, E.164 phones, explicit date format, future-date + impossible-date
rejection, human per-row skip reasons). The real gap was **header
auto-detection**, now closed:
- Broadened `guessMapping` HINTS to the real export headers of all four target
  platforms — Mindbody "Client ID"/"Last Visit", Glofox "Last Booking"/"Total
  Visits", TeamUp "Customer"/"Last attended", ABC "Last Check-In"/"Total
  Check-Ins" — plus attend/check/class visit synonyms and client/customer id
  prefixes. `src/lib/ingestion/csv.ts`.
- Locked each platform's headers into `csv.test.ts` (31 CSV tests, +4 platform
  cases). The always-required last-visit column now lands for every platform.
- **Still pending (B4/Track C):** testing against *actual* downloaded export
  files — the tests use faithful synthetic headers, not real files. Ask an
  engaged lead (JD) for a sample export.

### A4. Default win-back campaign copy in gym voice — `already met 2026-09-03`
Assessed against existing work and found already satisfied — not churning good
copy. `src/lib/template.ts` already ships gym-voiced `DEFAULT_SUBJECT`/
`DEFAULT_BODY` (win-back) and a gentler `DEFAULT_AT_RISK_*` variant; both follow
the brand rules (no em dashes, no presumption, one CTA). The new-campaign form
(`campaigns/new/form.tsx`) seeds these as the starting draft, switches them by
campaign kind without clobbering edits, renders a live preview with the exact
send code against a real member, exposes the `{{first_name}}`/`{{gym}}`/
`{{reason}}`/`{{booking_link}}` placeholders, and gates on mandatory approval.
`composeBody` auto-appends the booking link even if the gym omits the
placeholder. A gym can approve the default unedited today.

### A5. Empty / edge states + self-serve help — `done 2026-09-03`
- Empty/edge states were already handled across the app: dashboard (no members →
  the A2 checklist / no email addresses), campaigns/new ("nobody matches yet"),
  members, billing, data. Booking degrades correctly with no calendar. Confirmed
  by sweep; nothing missing.
- **FAQ gap closed:** the support widget (`support-topics.ts`) had no answer for
  the one wizard step it was missing — booking / connecting a calendar. Added a
  "How does booking work, and do I need to connect a calendar?" topic (covers
  turning booking on, why connect Google, works-without-calendar, the
  fail-closed-on-disconnect behaviour from A6). Also fixed a copy-paste slip in
  the "returned" topic's keywords. Verified the new topic renders in-browser.
  `mailto:info@casdey.com` fallback unchanged.

### A6. Google Calendar — production hardening — `mostly done 2026-09-03`
Done (all code-only, no migration — reuses the existing `revoked` status):
- **Fail closed on free/busy failure.** `fetchGoogleBusy` no longer swallows
  errors into "no busy times". A gym that never connected still returns `[]`
  (casdey-only, correct), but a gym whose connected calendar can't be read now
  throws `CalendarUnavailableError`; the booking page and `bookSlotAction` catch
  it and tell the member to reach out, rather than offering unverified slots.
  `src/lib/calendar/gym-slots.ts`, `book/[token]/page.tsx`,
  `book/[token]/actions.ts`.
- **Scope narrowed** from `calendar.events` to `calendar.app.created` (+ still
  `calendar.freebusy`) — casdey can only touch events it created. `google.ts`;
  test updated. **This is final for B1 — Davide can submit verification with it.**
- **`invalid_grant` → reconnect.** A dead refresh token now marks the connection
  `revoked` (distinguishable from a clean disconnect, which deletes the row), so
  Settings → Booking shows a reconnect banner and booking fails closed until the
  gym reconnects; the OAuth callback resets it to `active` on reconnect.
  `provider.ts` (`isInvalidGrant`, `calendarNeedsReauth`, `needsReauth` on the
  view), `settings/booking/page.tsx`.
- **Adjacent-slot / buffer race — FIXED 2026-09-03 (migration `0015`, applied
  to the live DB).** `bookings` gained `buffer_minutes` (snapshot) +
  `guard_end_at` (trigger-maintained = `end_at + buffer`), and a GiST
  exclusion constraint `bookings_no_overlap` rejects any overlap of
  `[start_at, guard_end_at)` for the same gym among `booked` rows. The booking
  action now treats `23P01` the same as `23505` ("that time was just taken").
  Verified against the live DB: an insert starting inside a prior booking's
  buffer is rejected with `23P01`; a genuinely back-to-back slot is allowed.
- **Still deferred (needs more than code, post-V1):** reconciling casdey↔Google
  mirror desyncs (an event deleted on Google out of band) needs a background
  job. Does not cause a double-booking.

### A7. GDPR / legal re-audit for the gym product — `done 2026-09-03 (one item → Davide)`
Earlier commits (`01b7713`, `628f556`) had already named the controller/processor,
dropped the false "not transferred outside the UK/EEA" claim, and removed the
"casdey does not hold member data yet" wording. Remaining gap found and fixed:
- **Google Calendar was missing from the DPA sub-processor list** while the list
  claimed "and no others" — the booking loop sends member name + email to Google
  (US). Added a Google Calendar bullet disclosing exactly that, scoped to gyms
  that connect a calendar, incl. US processing (Art. 28 + Art. 44). Verified
  in-browser. `terms/processing/page.tsx`.
- **Dental-wording sweep: clean.** Only a CSS comment and the intentional
  "appointment" search keyword remain; no dental terms in any member-facing or
  legal surface.
- `/privacy` confirmed correct (waitlist-scoped, points member data to the DPA,
  no false claims). WhatsApp correctly absent everywhere (not in V1).
- **Open → Davide (B-track):** the controller/processor **postal address** is
  deliberately deferred until casdey registers a legal entity (no P.IVA yet).
  Can't be invented; email-only contact is a defensible pre-entity posture. Fill
  it once the entity exists.

### A8. Free-plan limits — `done 2026-09-03`
Davide's decision (B7, 2026-09-03): **lock lapsed identities + cap members
imported** (not hide revenue, not keep-minimal).
- **Lock lapsed identities** — already built (`FREE_MEMBER_LIST_LIMIT = 5`): the
  members page shows the true total, reveals the first 5 by name, and locks the
  rest behind a "🔒 N more hidden on Free → Upgrade" card. Davide's pick endorses
  it; **verified in-browser** (8 lapsed → 5 shown, 3 locked).
- **Cap members imported** — new: `FREE_MEMBER_IMPORT_LIMIT = 50`, a cap on
  *net-new* members enforced at import. `applyImportCap` (pure, 5 unit tests) in
  `src/lib/ingestion/cap.ts`; wired into the import route so updates to existing
  members are never blocked, only new members beyond the cap are dropped and
  reported ("N new members not imported: Free holds up to 50, upgrade…"). An
  all-blocked import returns a 402 upgrade prompt, not a confusing mapping
  error. `plan.ts` gains `memberImportLimit`; the plans FAQ now states the caps.
- Suite 135/135, tsc/lint/build green.

### A9. Marketing landing copy — design review — `done 2026-09-03`
Screenshot-compared all seven sections (hero → CTA band → footer) against the
`brand assets` reference (Finpay layout) and the v3 Iron & Brass brand guide.
**Verdict: strong and on-brand** — a faithful, non-copied adaptation of the
reference, gym-voiced copy, distinctive subject-specific signatures (the
member-reactivation hero card, the lapse-"tail" bar chart), consistent tokens.
Not templated.
- **Fixed:** the footer tagline said "Cancelled-member reactivation" while the
  whole page + the meta title use "lapsed"; changed to "Lapsed-member
  reactivation" for consistency. `site-footer.tsx`.
- **Flagged, not changed (tied to the republish decision):** the header CTA says
  "Join the waitlist" while the hero/CTA-band say "Start your free week" — a
  deliberate artifact of the unpublish (header was stripped to a waitlist CTA).
  Align these when/if the homepage is republished (a separate V2-ish decision);
  moot while `/` redirects to `/waitlist` for invited-only V1.

### A10. Docs rewrite — `done 2026-09-03`
- **`SAAS_HANDOFF.md` rewritten** into gym language and current reality: what the
  product is (gym/member/booking), the real deployment state (/app live
  invited-only, calendar env in Vercel as of 2026-09-03, WhatsApp removed, migrations
  through 0013), the offer model incl. the new Free caps, what's verified
  (135 tests; full path not re-walked since the pivot → Track C/D), the go-live
  env vars, and out-of-scope. Points at this plan and `CLAUDE.md`.
- **`SAAS_ROADMAP.md` kept as history, by design** — it's a dated build log of
  items #1-#10; rewriting historical entries into new terminology would
  misrepresent what was recorded at the time. It carries a banner marking it
  superseded by this plan for V1 purposes.
- `CLAUDE.md` pointer updated to match.

---

## 3. TRACK B — external / ops / decisions (Davide)

Run in parallel with Track A. **B1 is the long pole — start it first.**

### B1. Google OAuth consent screen — publish — `done 2026-09-03` — **no verification needed**
**Published to production 2026-09-03 with NO verification review required.** The
long-pole "days-to-weeks review" never applied: A6's scope narrowing made both
calendar scopes **non-sensitive**, and Google only forces verification when an
app has >10 authorised domains, **a logo**, or **sensitive/restricted scopes**.
casdey has 2 domains, no logo (deliberately — uploading one would have triggered
verification), and non-sensitive scopes only, so the "Push to production" dialog
published it immediately. Result in prod: real gym owners can sign in with
Google (the 100-test-user cap no longer applies), connected-calendar refresh
tokens no longer die after 7 days, and the consent screen shows no "unverified
app" warning.
- **How it was done (2026-09-03):** enabled 2SV on `info@casdey.com` (owns the
  `casdey web` client, `casdey` project) and the personal account — Google Cloud
  hard-requires it since May 2025. Confirmed the redirect URI
  `https://casdey.com/api/calendar/google/callback` already whitelisted. On Data
  Access, declared `calendar.app.created` + `calendar.freebusy` (both land under
  "non-sensitive scopes"); branding already complete (app name, support email,
  home page, privacy, 2 authorised domains, dev contact); left the logo empty on
  purpose; then Audience → Publish app → In production.
- **Prereq that made this consistent:** the narrowed `calendar.app.created` scope
  was pushed to prod first (commit `bb99e10`, was in the 3 previously-unpushed
  commits), so what prod requests matches what was declared/published.
- **Client secret note:** the new console can't display an existing secret; it
  lives only in `web/.env.local` (ends `xfy7`). Add a new one if ever lost.
- **Reversible:** the Audience page now shows "Back to testing" if ever needed.

### B2. Calendar env vars into Vercel — `done 2026-09-03` (done ahead of B1)
`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` (from the "casdey
web" OAuth client) and `CALENDAR_TOKEN_KEY` are set in Vercel Production and
deployed; Settings → Booking shows "Connected as info@casdey.com". Done before
B1 cleared — it works now for the info@casdey.com test-user connection under
Testing mode; real prospects still need B1.
- **`CALENDAR_TOKEN_KEY` is NOT a fresh key — it must equal the local one.**
  Local dev and prod share the same Supabase DB, and this key encrypts calendar
  tokens at rest, so Vercel's value must be byte-identical to
  `web/.env.local`'s (ends `2o=`). A fresh key was generated by mistake first —
  it showed "Connected" but would have silently failed to decrypt tokens local
  wrote; corrected by pasting the local value. Never rotate it in one place only.

### B3. Confirm migrations applied on live DB — `done 2026-09-03`
Confirmed all three applied to the live Supabase project (`lxnzktbnustbimhdoyyw`,
eu-west-1) via a read-only schema probe over `SUPABASE_DB_URL`:
- **`0011`** (dental→gym rename): `gyms`/`members`/`bookings`/`gym_users`/
  `services` present, `practices` and the four `whatsapp_*` tables gone,
  `gyms.lapsed_after_months` + `gyms.booking_value_minor` + `members.returned_at`
  renamed, functions `create_gym` + `is_gym_user` present.
- **`0012`** (at-risk campaigns): `gyms.at_risk_after_days`, constraint
  `gyms_at_risk_before_lapse`, `campaigns.kind` all present.
- **`0013`** (cancellation reason): `members.cancellation_reason` +
  `members.cancelled_at` present; `member_events_type_check` includes both
  `return_undone` and `cancelled`.

### B4. Source real gym-platform CSV exports — `todo` (feeds A3)
Real member-export CSVs from Mindbody / Glofox / TeamUp / ABC Fitness — even one
or two each. Ask engaged leads (e.g. JD) for a sample export as part of the
onboarding conversation.

### B5. Confirm Vercel plan — `done 2026-09-03`
Confirmed **Hobby** (the plan badge on the `casdey` project reads "Hobby"). The
once-daily cron cap is real; keep `vercel.json` on `0 3 * * *`. Revert to hourly
only if the team is later upgraded to Pro.

### B6. Delete stray Vercel project — `done 2026-09-03`
The empty `web` project (`prj_vDppOjy92hHyW7tonXDzBbnpgOIY`, created 2026-08-19
20:44 during the deploy-pipeline fix, zero deployments, no production URL) was
removed via `vercel project rm web`. `vercel projects ls` now shows only
`casdey`.

### B7. Decide Free-plan limits — `done 2026-09-03`
Davide chose **lock lapsed identities + cap members imported**. A8 built both.

### B8. Upgrade the Twilio account — `todo` (blocks E1 prod send)
The WhatsApp channel's outbound send has always been blocked on Twilio's trial
limits (Content Templates + custom webhook config both gated behind a paid
account). E1 can be built and tested against the sandbox, but a real prospect
WhatsApp send needs the upgrade. Davide's to do.

### B9. Confirm JD's gym software — `answered 2026-09-03: LegitFit`
JD runs **LegitFit** (Irish gym/studio booking + membership platform). Open
sub-question, still needs JD: can they share API credentials or a developer
account? **Feasibility risk:** LegitFit is a smaller vendor and does not
publish an open developer API the way Mindbody does; if there is no
member-export API JD can grant access to, **E2 slips to V2** and CSV export
(A3) stays the V1 import path. First step of E2 is to establish this.

---

## 3.5. TRACK E — JD's feature-list additions (rescoped into V1, 2026-09-03)

JD's cold-outreach asks, pulled into V1 per §0. The first two of JD's four
(at-risk detection, cancellation reasons) already shipped in `88ff34f`. These
are the rest.

### E1. WhatsApp channel + AI reply loop — revive for gym — `code done 2026-09-03; prod verify + B8 left` — firm V1
Restored the WhatsApp channel built pre-pivot (`81d9a93`, `314c291`) and
deleted in the gym rebuild (`25af6aa`). Commit `cd0fd70`.
- **Done — engine.** `src/lib/whatsapp/{twilio,signature,send,ai-agent,campaign-send}.ts`
  restored from `c3c9a25` and adapted to gym (`gym`/`member`/`gym_id`/
  `member_id`, `is_gym_user` RLS). `sanitize.ts` split out (testable, like
  `signature.ts`). `buildWhatsAppAudience()` in `campaigns.ts` — lapsed +
  cancelled, gated on phone + `consent_whatsapp`, phone-keyed suppression.
- **Done — migration `0014_whatsapp_channel_gym.sql`, APPLIED to the live DB
  2026-09-03** (transaction, verified). Re-adds `whatsapp_conversations` /
  `_messages` / `_suppressions` / `_events`, widens `campaigns.channel` back to
  `('email','whatsapp')`, adds `members.consent_whatsapp`,
  `gyms.whatsapp_enabled` / `whatsapp_template_name`,
  `campaigns.whatsapp_template_name`, and a new `claim_whatsapp_ai_turn()` SQL
  function for the atomic reply-cap claim.
- **Done — the 5 audit bugs, fixed on the way back in:** (1) leading assistant
  (template) turns dropped so the Anthropic array starts with the member;
  (2) reply-cap race → atomic `claim_whatsapp_ai_turn()` UPDATE…RETURNING;
  (3) history now newest-first + LIMIT then reversed; (4) STOP keywords cover
  DE/FR/ES/PT/IT/NL; (5) `sanitizeReply()` drops a reply that invents a
  time/price or gives injury/training advice (12 unit tests).
- **Done — UI.** Settings → WhatsApp tab (enable + template SID). New-campaign
  form gets an Email/WhatsApp switch (WhatsApp = win-back only, no
  subject/body). `createCampaignAction` / `approveCampaignAction` branch on
  channel; a WhatsApp campaign sends its template batch synchronously on
  approval → `sent`. Campaign detail: WhatsApp test-send (typed number, E.164)
  + opener card. Member page: read-only conversation card with the hand-off.
- **Done — legal.** Twilio (US) + Anthropic (US) back on the DPA
  sub-processor list, scoped to gyms that enable WhatsApp. `.env.example`
  documents `TWILIO_*` + `ANTHROPIC_API_KEY` + `CASDEY_WHATSAPP_AI_MODEL`.
- **Left:** (a) **B8** — Davide upgrades the Twilio account off the trial tier
  (Content Templates + inbound webhook config are gated); nothing sends in
  prod until then, though the UI + `disabled`-provider fallback work.
  (b) `TWILIO_*` + `ANTHROPIC_API_KEY` into Vercel Production.
  (c) Point Twilio's inbound webhook at `https://casdey.com/api/whatsapp/webhook`.
  (d) Prod verification: one real template send + reply loop + STOP + hand-off
  (folds into Track C).

### E2. Direct LegitFit member sync — `blocked on API access` — best-effort V1, drop to V2 if walled
Real member-list sync from **LegitFit** (B9), replacing CSV re-upload. The
current `src/lib/ingestion/mindbody.ts` is a stub — a LegitFit adapter would
sit next to it behind the same `ingestion` interface.
- **First step — establish whether a LegitFit member-export API even exists
  that JD can grant casdey access to.** LegitFit publishes no open developer
  API; there may be an account-level export/integration, a Zapier hook, or
  nothing. If there is no programmatic path JD can authorise → **E2 exits to
  V2**, and CSV export (A3) is the V1 import path. Expected, acceptable outcome.
- If reachable: one adapter behind `ingestion` (normalise to `members`, E.164
  phones, last-visit), a Settings → Integrations connect flow, a manual +
  scheduled resync. LegitFit only for V1.
- Do **not** build a generic multi-vendor integration framework for one
  adapter — that abstraction waits until a second platform is real.

---

## 4. TRACK C — production verification (me + Davide, after A + B green)

Not the same as Davide's walkthrough — this is targeted proof each integration
works in prod with real credentials, using throwaway data.

- **C1.** One real **live-mode** Stripe checkout → Premium → guarantee claim →
  refund, end to end in production (only ever done in test mode so far).
- **C2.** One real campaign send through **Resend** in production (approve a
  campaign to a safe test address, confirm it queues + delivers with the
  gym's reply-to).
- **C3.** **Calendar booking** end to end in production: connect a real Google
  Calendar, book a slot via the member link, confirm the event lands, cancel,
  confirm it's removed.
- **C4.** Walk **every wizard step** (A2) in production with a throwaway
  account; confirm no prod-only breakage.

Any failure here → back to the relevant Track A item.

---

## 5. TRACK D — final acceptance (Davide only, last)

**D1. Davide's uninterrupted self-serve walkthrough.** Once Tracks A, B and C
are all green, Davide signs up as a brand-new "gym" and goes through the entire
flow from §0 **with no help and no shortcuts**, as a real invited lead would.
Any break, confusion, or rough edge → fix in Track A, re-verify in Track C,
walk again. When this passes clean, **V1 is ready** and engaged leads can be
invited (per the `SAAS_ONBOARDING.md` playbook).

---

## 6. Critical path & sequencing

```
Day 1   ── B1 (Google verification submitted) ─────────────── weeks of review ──┐
        └─ A1 (discovery pass) ── 1 session                                     │
                                                                               │
Then    ── A2 ─ A3 ─ A4 ─ A5   (core self-serve build, overlapping)            │
        └─ B3, B4, B5, B6, B7  (Davide, in parallel)                           │
                                                                               │
Then    ── A6 (calendar hardening; scope finalised BEFORE B1 submit) ──────────┤
        └─ A7 (legal re-audit)   A8 (needs B7)   A9 (polish)                    │
                                                                               │
B2 (calendar env vars) done early 2026-09-03 — works now for the test-user ─────┘
                 connection; real-prospect Google use still waits on B1
                                                                               │
Then    ── TRACK C  (prod verification: C1 Stripe, C2 Resend, C3 Calendar, C4) │
Then    ── A10 (docs rewrite, housekeeping)                                     │
Then    ── TRACK D  (Davide's walkthrough) ──► V1 READY
```

**Rules that keep this honest:**
- B1 starts before any building, because its clock is external and long.
- A6's scope decision happens **before** B1 is submitted, or verification has to
  be redone.
- Track D is **last**. Davide's manual walkthrough is the acceptance gate, never
  a debugging tool mid-build.
- **WhatsApp (E1) and gym-software sync (E2) are now V1** (rescoped 2026-09-03).
  E1 is firm; E2 is best-effort and may exit back to V2 if its partner-API
  access is too slow (gate at B9). Run Track E in parallel with the tail of
  Track A; it must be green before Track C signs off.
- Remaining true-V2 items (#10 offer page, homepage republish) do not enter any
  track until D passes.

---

## 7. Item status board

| ID | Item | Owner | Status |
|----|------|-------|--------|
| A1 | Discovery / ground-truth pass | me | code-side done; prod walk → C4 |
| A2 | Guided first-run setup checklist | me | done (local, verified) |
| A3 | CSV import hardening vs real exports | me | code-side done; real-file → B4/C |
| A4 | Default win-back copy in gym voice | me | already met |
| A5 | Empty/edge states + FAQ per step | me | done |
| A6 | Calendar prod hardening (fail-closed, scope, re-auth) | me | done — incl. the double-booking exclusion constraint (0015); only Google-mirror reconciliation job left, post-V1 |
| A7 | GDPR/legal re-audit for gym | me | done (postal address → Davide) |
| A8 | Free-plan limits implementation | me | done |
| A9 | Marketing landing design review | me | done |
| A10 | Rewrite SAAS_HANDOFF (ROADMAP kept as history) | me | done |
| B1 | Google OAuth consent screen: publish | Davide | done — published to prod, no verification needed (non-sensitive scopes) |
| B2 | Calendar env vars into Vercel | Davide | done (ahead of B1) |
| B3 | Confirm migrations 0011/0012/0013 on live DB | Davide | done — all three verified on live DB |
| B4 | Source real Mindbody/Glofox/TeamUp/ABC CSVs | Davide | todo |
| B5 | Confirm Vercel plan; revert cron if Pro | Davide | done — Hobby |
| B6 | Delete stray empty Vercel project "web" | Davide | done — removed, only `casdey` remains |
| B7 | Decide Free-plan limits shape | Davide | done (→ A8) |
| B8 | Upgrade Twilio account (blocks E1 prod send) | Davide | todo |
| B9 | Confirm JD's gym software + API access (feeds E2) | Davide | platform = LegitFit; API-access question still open |
| E1 | WhatsApp channel + AI reply loop — revive for gym | me | code done + 0014 applied 2026-09-03; prod verify + B8 left |
| E2 | Direct gym-software API sync | me | todo — best-effort, may exit to V2 (gate B9) |
| C1 | Live-mode Stripe checkout + refund in prod | both | todo |
| C2 | Real Resend campaign send in prod | both | todo |
| C3 | Calendar booking end-to-end in prod | both | todo |
| C4 | Every wizard step verified in prod | both | todo |
| D1 | Davide's uninterrupted self-serve walkthrough | Davide | todo — final gate |

Update this board as items move. This doc is the pointer target from
`CLAUDE.md`, `SAAS_ROADMAP.md`, and `SAAS_ONBOARDING.md`.
