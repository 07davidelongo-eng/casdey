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
  known audit bugs. The external blocker was Twilio's trial tier; **cleared
  2026-09-04 (B8)**. The remaining gate is a Meta-approved sender plus template
  approval. Channel choice confirmed **WhatsApp** (not SMS).
- **E2. Direct gym-software API sync** — was best-effort V1, allowed to drop to
  V2 if the partner-API wall proved too slow. **It exited to V2 on 2026-09-04**,
  which is exactly the outcome this bullet allowed for: LegitFit publishes no
  developer API and its Zapier app is trigger-only, so nothing can pull a gym's
  existing member list. **CSV (A3) is the V1 import path.** Full evidence in E2.

**Still explicitly NOT in V1** (deferred to V2, do not let these expand scope):
the #10 win-back/comeback-offer interactive page, republishing the public
marketing homepage (invited-only signup does not need it).

**3-tier pricing — pulled INTO V1 on 2026-09-03** (Davide's call, same move as
the WhatsApp rescope). **Free / Standard / Pro** replaces today's Free vs
Premium. Now **Track F** below. Blocked on Davide supplying the tier
definitions (prices per tier in GBP + EUR, monthly + annual; the capability
split; how the lifetime early-adopter discount and existing "Premium" accounts
map across three tiers).

**Was parked here, now done:**
- **Brand identity refresh**: `done 2026-09-04`, commit `f524f86`. Unparked
  early once Davide gave the design direction (light ground, gold primary,
  Outfit for titles). Shipped as **v4 "Chalk & Struck Gold"**, superseding v3
  "Iron & Brass": new palette, new type stack, and casdey's first logo mark.
  Token names unchanged, so no component code moved. See `CLAUDE.md` →
  "Brand v4" and `brand assets/casdey-brand-guide.html` (rewritten to v4).

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
`brand assets` reference (Finpay layout) and the then-current v3 Iron & Brass
brand guide (the palette has since moved to v4, the layout verdict stands).
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
B1 cleared, so at the time it worked only for the info@casdey.com test-user
connection under Testing mode. B1 has since cleared (same day), so real
prospects can connect too.
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

**LegitFit is now the one that matters most (added 2026-09-04).** E2 established
that CSV is the *only* way a LegitFit gym can get its members into casdey, and
JD runs LegitFit — so his export is both the first real onboarding and the test
file for A3's column mapping. Ask for it in the same message that asks whether
export is available at any time or only on cancellation (see E2).

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

### B8. Upgrade the Twilio account — `done 2026-09-04` (E1 prod send now gated on a Meta sender, not on billing)

**Done.** Davide upgraded and funded the account; verified via the Twilio API
rather than the dashboard: `type` went **Trial → Full**, `status: active`,
balance **$20.00 USD**. The Content Template API, which returned an error on
trial, now returns HTTP 200 — so the tier gate genuinely lifted.
- Upgraded as **Individual**, not Business: there is no Partita IVA yet, so
  there is no VAT number to enter and no EU B2B reverse charge. Consequence:
  Twilio charges Italian VAT (22%) on usage until a P.IVA exists, at which
  point the tax details can be updated in place. See the Legal/tax section of
  `CLAUDE.md`.
- **Auto-recharge deliberately left off** for now. casdey is a bulk sender and
  the WhatsApp reply loop's five bug fixes have never run against real traffic;
  with auto-recharge on, a runaway loop tops itself up, with it off the worst
  case is that it stops at $20. Revisit after a real campaign behaves.
- **Vercel (Production + Preview):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  and `ANTHROPIC_API_KEY` are set. They take effect on the next deployment,
  which is needed anyway when the sender lands.
- **`TWILIO_WHATSAPP_FROM` deliberately NOT set in Vercel.** The value in
  `web/.env.local` (`+4915888623971`) is **Twilio's shared WhatsApp Sandbox
  number, not a number casdey owns** — the account holds 0 phone numbers. The
  sandbox only delivers to people who have joined it with a join code, so
  setting it in Production would make `whatsappProvider()` report the channel
  as **enabled** while real member messages silently reached nobody. Since the
  provider requires all three vars, omitting this one keeps the channel
  honestly **disabled** (settings save, sends error clearly) until a real
  sender exists. Set it in the same pass that adds the sender.

**What actually blocks a real WhatsApp send now — not money:**
- A **WhatsApp sender approved by Meta** (0 phone numbers, 0 messaging services
  on the account today), and **template approval** for the opener (0 content
  templates). Both are review processes measured in days.
- The **inbound webhook** (`https://casdey.com/api/whatsapp/webhook`) is
  configured *on a sender*, so it cannot be pointed anywhere until the sender
  exists. It is not a separate blocker, it is a step of the same task.

### B8 (original description + account reference, kept for context)
The WhatsApp channel's outbound send was blocked on Twilio's trial limits
(Content Templates + custom webhook config both gated behind a paid account).
That gate is now lifted — see the B8 entry above.

**Which account to log into (established 2026-09-04, it was not written down
anywhere):**
- The Twilio account is on **info@casdey.com**, not the personal Gmail.
  Confirmed from the Zoho mailbox: Twilio's onboarding mail from 2026-08-15,
  08-17 and 08-21 all went to `info@casdey.com`, and there is no Twilio mail at
  all in `07davide.longo@gmail.com`.
- **Sign in with "Continue with Google"** on the info@casdey.com Google
  Account — there is probably no password. A Google notice on 2026-08-15,
  "You shared some Google Account data with Twilio", shows the signup went
  through Google SSO.
- Account SID starts `ACd3a30e46…` (full value in `web/.env.local`), created
  **2026-08-15**. Upgraded to **`type: Full`** on 2026-09-04 (verified via the
  Twilio API, not the dashboard).
- Note `info@casdey.com` is a Zoho **group**, delivered to both Davide and
  Abhi, so Twilio mail reaches them both.

### B9. Confirm JD's gym software — `closed 2026-09-04: LegitFit, no API → E2 to V2`
JD runs **LegitFit** (Irish gym/studio booking + membership platform). The open
sub-question (can they share API credentials?) is **answered: there is nothing
to share.** LegitFit publishes no developer API, and its Zapier app is
trigger-only, so there is no way to pull an existing member list out
programmatically. **E2 slipped to V2** and CSV export (A3) is the V1 import
path — see E2 for the full evidence and the two things still worth asking JD
(is export available anytime or only on cancellation, and does an unadvertised
partner API exist).

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
- **Left, as of 2026-09-04:**
  (a) ~~B8, the Twilio trial upgrade~~ — **done**, Trial to Full, $20 balance,
  verified via the API; the Content Template endpoint now returns 200.
  (b) ~~`TWILIO_*` + `ANTHROPIC_API_KEY` into Vercel~~ — **partly done**:
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `ANTHROPIC_API_KEY` are in
  Production and Preview. **`TWILIO_WHATSAPP_FROM` is deliberately still
  unset** — see B8 for why (the local value is Twilio's shared Sandbox number,
  and setting it would flip the channel to "enabled" while messages reached
  nobody). It goes in with the real sender.
  (c) **A WhatsApp sender approved by Meta, plus template approval.** This is
  now the real blocker: the account has 0 phone numbers, 0 messaging services
  and 0 content templates. Days, not minutes.
  (d) Point Twilio's inbound webhook at `https://casdey.com/api/whatsapp/webhook`
  — configured *on the sender*, so it is a step of (c), not separate.
  (e) Prod verification: one real template send + reply loop + STOP + hand-off
  (folds into Track C).

### E2. Direct LegitFit member sync — `EXITS TO V2 (decided 2026-09-04)`
Real member-list sync from **LegitFit** (B9), replacing CSV re-upload. The
first step the plan called for — establish whether an authorisable export path
exists — was done 2026-09-04. **It does not, for the load casdey needs.** This
is the outcome the plan already called expected and acceptable.

**What was found (LegitFit's own pages + their Zapier listing):**
- **No public developer API.** Their integrations page names 14 partners
  (GoHighLevel, ClassPass, Zapier, Stripe, Mailchimp, Google Calendar/Sheets,
  Trainerize, …) and mentions **no API, no API keys, no webhooks**.
- **The Zapier app is trigger-only:** 4 triggers (New Booking, New Client, New
  Membership, New Package), **0 actions and 0 searches**. Confirmed twice — the
  app page lists triggers only, and on a Quick Connect page LegitFit appears
  solely as the initiating service while the other app supplies every action.

**Why trigger-only kills it, which is the real point.** Zapier triggers fire
*forward* from the moment a Zap is switched on; they cannot backfill. casdey's
entire job is finding members who lapsed — people who joined and stopped
attending **in the past**. On day one a Zapier connection would surface
**zero** lapsed members, and would then report new clients and new bookings,
i.e. precisely the **active** members, who by definition are not the target.
It is not an incomplete integration, it is the wrong population. With no
action or search there is no way to ask LegitFit "give me the member list",
which is the one question casdey needs answered.

**So the V1 path is CSV, which is already built (A3).** LegitFit's FAQ says a
gym can "export client lists, booking history and payment records" in CSV —
which is exactly the shape `src/lib/ingestion/csv.ts` consumes, and its column
aliases (`/last.*(visit|booking|seen|attend|check|class)/i` and friends) are
broad enough that a LegitFit export should auto-map; the gym confirms the
mapping before anything is written, so a miss is recoverable rather than
silent.

**Two caveats, both cheap for JD to settle:**
1. LegitFit's pages disagree on *when* export is available: `/migrate` frames
   it as "**if you cancel** LegitFit, you can export…", while `/features`
   says "at any time". JD can confirm in his own account in seconds. If it
   really is cancellation-only, that is a genuine V1 problem for LegitFit gyms
   and worth knowing now.
2. This is all from public marketing and the public Zapier listing. A private
   or partner API could exist that is simply not advertised. The definitive
   answer is JD asking LegitFit support directly — worth one message, but not
   worth blocking V1 on.

**Deliberately not done:** reverse-engineering the LegitFit web app's own
backend calls with JD's credentials. It would be fragile, near-certainly
against their terms, and a bad foundation for something casdey charges for.

**Carried to V2, if a LegitFit gym ever becomes a real customer:** the
**New Booking** trigger is genuinely useful for *keeping last-visit dates
fresh* after an initial CSV import (gym creates one Zap → casdey webhook). That
is incremental sync, not the initial load, so it does not rescue E2 for V1.
- Whenever this is revisited: one adapter behind `ingestion` (normalise to
  `members`, E.164 phones, last-visit), a Settings → Integrations connect flow,
  manual + scheduled resync.
- Do **not** build a generic multi-vendor integration framework for one
  adapter — that abstraction waits until a second platform is real.

---

## 3.6. TRACK F — 3-tier pricing (Free / Standard / Pro)

Pulled into V1 2026-09-03. Replaces today's Free vs Premium (`src/lib/plan.ts`,
`src/lib/stripe.ts`). **Blocked until Davide supplies the tier sheet** — see
F0. Everything below is the implementation shape once F0 lands; nothing starts
before it.

### F0. Tier definitions — `answered 2026-09-03` (Davide)

casdey's market is **Europe**, so pricing leads in **EUR**; GBP keeps its own
round numbers for UK, not a live conversion.

| | **Free** | **Standard** | **Pro** |
|---|---|---|---|
| Monthly | €0 | **€99** (~£89) | **€289** (~£249) |
| Annual (2 months free) | — | €990 | €2,890 |
| Early-adopter (lifetime −20%, both tiers) | — | eff. €79 | eff. €231 |
| Send email campaigns (win-back + at-risk) | ✗ | ✓ | ✓ |
| Member cap (net-new, at import) | 50 | **200** | **2,000** |
| Member-list view | 5 rows | full | full |
| Booking / calendar | ✗ | ✓ | ✓ |
| WhatsApp channel | ✗ | ✗ | **✓** |
| Profit-or-nothing guarantee | ✗ | ✗ | **✓** |
| LegitFit sync (E2, if it ships) | ✗ | ✗ | ✓ |

- **Existing "Premium" accounts → Pro** (already backfilled by `0016`).
- **Discount** is now a single flat **20% percent-off** coupon
  (`STRIPE_COUPON_PERCENT`), currency-agnostic, replacing the old per-currency
  £50/€59 fixed coupons. Applies to both paid tiers.
- **Free is unchanged.**

**Cost basis (why these numbers).** Recorded so the rationale isn't lost:
- Fixed/shared infra (Supabase, Vercel, shared Twilio number, Resend base):
  **~€0–2 / gym / month**, shrinks with scale. Not a pricing input.
- Email (Resend): ~€0.0004/email → **€0.20–0.75 / gym / month**. Negligible.
- **WhatsApp opener (Pro only, the one cost that matters):** ~**€0.06** per
  marketing template, EU blended. Scales linearly with members contacted:
  200 → €12, 500 → €30, 1,000 → €60, 2,000 → €120, 5,000 → €300 / month. The
  opener fires once; monthly re-runs only hit newly-lapsed members, so a Pro
  gym's steady-state WhatsApp cost falls to ~€10–30/mo after month one. The
  reply-loop conversation is inside WhatsApp's 24h service window = free.
- AI replies (Claude Haiku 4.5, $1/$5 per 1M tok): ~€0.011 per conversation →
  **€1–2 / gym / month**. Negligible.
- **COGS: Standard ~€1.50–3/mo (~97% margin at €99). Pro ~€15–125/mo
  (first-month WhatsApp-driven), ~€15–35/mo steady-state → ~57% worst first
  month, ~90%+ ongoing at €289.**
- This is why **Pro is capped at 2,000, not unlimited** (a 5,000-member Pro
  gym WhatsApping monthly ≈ €300 COGS vs €289 revenue), and why **WhatsApp +
  the guarantee are Pro-only** (WhatsApp is the entire reason Pro costs more
  to serve; the guarantee is a real refund liability). Standard's 200 cap is a
  product/upsell lever, not a cost one — email is ~free to serve.

### F1. Plan model — `code done 2026-09-03`
- `Plan` = `"trial" | "free" | "standard" | "pro"` (`premium` retired).
  `isPaidPlan()` helper. `planLabel()` → Free / Free week / Standard / Pro.
- `gyms.plan_tier` (`'standard' | 'pro' | null`) added by `0016` (applied to
  the live DB; 2 existing paying gyms backfilled to `pro`, 1 untiered).
  `effectivePlan()` returns the stored tier for an active/past_due sub;
  **defaults a tier-less active sub to `pro`** until F2's price env vars exist.
- `capabilities()` is a per-plan table: `canSendCampaigns` /
  `canUseWhatsApp` / `hasGuarantee` / `memberListLimit` / `memberImportLimit`.
  **Caps: Free 50, Standard 200, Pro 2,000.** WhatsApp + guarantee are Pro
  (trial grants both). `past_due` holds sending, keeps feature grants.
- **Gates wired:** WhatsApp campaign create + approve reject if
  `!canUseWhatsApp`; `api/guarantee/claim` rejects if `!hasGuarantee`; the
  import route's over-cap message is plan-aware (Pro → "contact us", not
  "upgrade").
- Webhook resolves `plan_tier` from the subscription price via
  `planTierForPriceId()`, writing it only when a tier resolves (never nulls).

### F2. Stripe products/prices — `done 2026-09-04 (live catalogue created + Vercel set)`
- `stripe.ts`: `PRICE_PLANS` (8 entries, EUR-first), `pricePlansFor(tier,
  ccy)`, `findPricePlan(tier, ccy, interval)`, `priceIdFor(plan)`.
  `couponIdFor()` prefers `STRIPE_COUPON_PERCENT` (flat 20%), old per-currency
  coupons as fallback.
- `scripts/stripe-setup.mjs` rewritten: creates **2 products (casdey Standard,
  casdey Pro), 8 prices, 1 × 20% forever coupon** in **test mode**. Refuses a
  live key.
- `.env.example` documents the 9 new vars
  (`STRIPE_PRICE_{STANDARD,PRO}_{EUR,GBP}_{MONTH,YEAR}` + `STRIPE_COUPON_PERCENT`).
- **Done 2026-09-04, live.** The blanket "refuses a live key" guard became an
  explicit opt-in (`npm run setup:stripe -- --live`) instead: the point was to
  stop an *accidental* live run, and a flag does that without making the live
  catalogue a hand-typing exercise. Creating prices charges nobody; they are
  catalogue entries, immutable once made but archivable, and no money moves
  until a checkout completes.
  - Live now holds **casdey Standard** and **casdey Pro**, their 8 prices, and
    `casdey_early_20pct` (20% off, forever). The script is idempotent (lookup
    keys), so a re-run reports "exists" rather than duplicating.
  - All 9 vars are set in **Vercel Production and Preview**, and the **6
    retired ones were removed** (`STRIPE_PRICE_{EUR,GBP}_{MONTH,YEAR}`, which
    nothing reads, and `STRIPE_COUPON_{GBP,EUR}`, the fixed-amount £50/€59
    coupons that would over-discount Standard if they ever became reachable).
    Production now carries exactly 11 `STRIPE_*` vars: 8 prices, 1 coupon, the
    secret key, the webhook secret.
  - Verified with `npm run check:stripe` against the live key: all 8 prices
    resolve to active, correctly-priced recurring prices, and the coupon is 20%
    forever. The live webhook event set is unchanged.
- **Still open, and Davide's:** `web/.env.local` has no test-mode set, because
  the only Stripe key on this machine is the **live** one. Paste the test
  secret key from the Stripe dashboard and run `npm run setup:stripe` (no flag)
  to build the test catalogue. Until then, do not run a local checkout: it
  would charge a real card.
- **Verify it with `npm run check:stripe` (added 2026-09-04) rather than by
  eye.** It reads the env, calls Stripe, and confirms each of the 9 values
  resolves to a real, active, correctly-priced recurring price (and a 20%
  forever coupon) in whichever mode the key belongs to. It catches exactly the
  mistakes hand-entry makes: a missing var, a test id in the live config, a
  product id pasted instead of a price id, two vars pointing at the same price,
  a wrong amount, an archived price, a fixed-amount coupon where the flat 20%
  belongs. It also confirms the **webhook endpoint** exists, is enabled, points
  at `/api/stripe/webhook`, and subscribes to all 6 events the route handles —
  a missing event is silent in the expensive direction: Stripe shows a healthy
  endpoint, the money is taken, and the gym is never marked as paying.
  Read-only, safe against the live account, exits non-zero on any problem. Run
  it against the live key before C1:
  `STRIPE_SECRET_KEY=sk_live_... npm run check:stripe`.
- The price table now lives once, in `scripts/price-spec.mjs`, shared by the
  setup and check scripts; `stripe.test.ts` asserts it still agrees with
  `PRICE_PLANS`, so the app cannot drift from what Stripe was told to charge.
- **Current state (checked 2026-09-04):** `web/.env.local` still holds the
  **retired** 4-var names (`STRIPE_PRICE_{GBP,EUR}_{MONTH,YEAR}`) and both old
  coupons; none of the 9 new vars are set, in either mode. Note also that the
  local `STRIPE_SECRET_KEY` is a **live** key, so a local checkout would take
  real money — worth swapping for the test key while testing.

### F3. Checkout + billing UI — `code done 2026-09-03`
- `api/stripe/checkout` takes `tier` (`standard`|`pro`, default `pro`) +
  `interval`; currency still derived from country.
- `settings/billing/page.tsx`: Free/trial see a Standard + Pro chooser (each
  with monthly + annual cards); a Standard gym sees "Upgrade to Pro" only; a
  paid Pro gym sees no upgrade block. Discount copy = "20% off either plan".
  `PlanPill` renders Standard/Pro.

### F4. Guarantee + discount — `code done 2026-09-03`
- `api/guarantee/claim` rejects a non-Pro gym ("The guarantee is on the Pro
  plan"). The billing page's guarantee card shows a Pro-upsell line for a
  Standard gym, the full status card for trial/Pro, nothing for Free.
- The early-adopter coupon (`STRIPE_COUPON_PERCENT`, 20% forever) is
  currency-agnostic and applies to whichever paid tier the gym picks — no
  per-tier mapping needed.

### F5. Copy + FAQ — `done 2026-09-03`
Swept "Premium" → tier-aware wording across billing page/banner, the support
FAQ's plan + guarantee topics, the campaign send-gate error, the import-page
note, the waitlist FAQ ("pick a paid plan", "lifetime 20%"). `premium_started_at`
(DB column) and internal `not_premium` guarantee reason left as-is.

### F6. Tests — `done 2026-09-04`
`plan.test.ts` covers the 4-plan capability matrix incl. the 200/2,000 caps
and the Standard/Pro WhatsApp+guarantee split.

**Closed 2026-09-04.** The price→tier mapping is no longer left to C1. The
`server-only` import that made `stripe.ts` untestable is now aliased to a stub
inside vitest only (`test/server-only-stub.ts`, wired in `vitest.config.mts`),
and `src/lib/stripe.test.ts` covers `planTierForPriceId`, the 8-price table and
`couponIdFor` — including the half-configured cases. 164 tests total.

**Real bug found while closing it — tier resolution could silently over-grant.**
`planTierForPriceId` reverse-matches a Stripe price id against the nine
`STRIPE_PRICE_*` env vars, which are set by hand (F2). If a Standard var was
missing or mistyped, the lookup resolved nothing, the webhook left `plan_tier`
null, and `effectivePlan()` reads a null tier on an active subscription as
**Pro** — handing a €99/mo Standard gym the WhatsApp channel and the
*refundable* profit-or-nothing guarantee. Fixed by not depending on the env
vars alone: `/api/stripe/checkout` now stamps the chosen tier onto the
subscription metadata (`plan_tier`), and the webhook falls back to that
whenever the price lookup fails. Price id stays authoritative when configured.

---

## 3.7. TRACK G — per-gym sending identity (pulled into V1, 2026-09-04)

**Davide's call, and he called it non-negotiable.** casdey's entire pitch is
that it contacts lapsed members **as the gym**. Until now that was only
half-true, and broken differently per channel:

| | What the member saw | Fixable in copy? |
|---|---|---|
| Email | `Iron Works Gym <no-reply@mail.casdey.com>` — right name, casdey's address, visible on expanding the header | Partly |
| WhatsApp | A business called **casdey**, for every gym | **No** |

The WhatsApp case is the severe one and the reason this became a V1 track
rather than polish. On WhatsApp the **display name is a property of the sender
number, not the message**, so a single shared casdey number could only ever
introduce itself as casdey to somebody else's lapsed members. No wording
change reaches it.

**The fix, both channels: the gym brings its own identity and casdey sends
through it rather than on top of it.** Migration `0017`.

### G1. Email from the gym's own domain — `code done 2026-09-04, blocked on a key`
> **Found 2026-09-04, after G1 was called done: this has never been able to
> work.** `RESEND_API_KEY` was created Sending-access-only back on 2026-08-15,
> which is correct for the send path but means every `/domains` call answers
> `401 restricted_api_key`, locally and in production alike. Nothing surfaced
> it — the gym was shown "we could not reach the email provider", which reads
> as a blip worth retrying, and the retry could never succeed. A key's *scope*
> is invisible until something calls what it cannot do.
>
> Fixed in code: domain management now reads a second, Full-access key
> **`RESEND_ADMIN_API_KEY`** (falling back to `RESEND_API_KEY`, for a
> deployment that has only one Full-access key). Kept separate deliberately —
> the key sitting in the hot path of every campaign send should not be able to
> list or delete the sending domains of every gym on casdey. A 401/403 is now
> its own `ResendKeyNotPermittedError`, and the gym is told setup is not
> switched on rather than told to retry. **`npm run check:resend`** probes both
> keys against the real API and exits non-zero; it reports this exact failure.
>
> **Done later the same day:** the Full-access key `casdey-domains-admin` was
> created, set in `web/.env.local` and in Vercel Production + Preview, and
> `npm run check:resend` passes. The UI was then driven end to end for the first
> time (connect → `AWAITING DNS` → records table → check again), which found the
> two things below.

**G1a. The Resend plan is the real ceiling — found 2026-09-04, NOT a code problem.**
Connecting a second gym domain through the UI returned:

```
403 "You have reached the domain limit of your plan. Upgrade to add more."
```

casdey is on Resend **Free: 3 domains, 3,000 emails/month, 100 emails/day.**
Two of those three domains are casdey's own (`casdey.com`, `mail.casdey.com`),
so **exactly one gym can have its own sending domain today**. Per-gym sending
needs one Resend domain per gym, so the plan's domain allowance is a hard
ceiling on how many gyms can send under their own name at once.

**The daily send cap is the more urgent half.** 100 emails/day makes casdey
unusable for even one real gym: a single win-back campaign across a few hundred
lapsed members exceeds a day's entire allowance, and the cron drains once daily.
This is not a per-gym-identity problem, it caps the core product.

| Resend plan | Domains | Gyms with own domain | Emails/mo | Daily cap | Cost |
|---|---|---|---|---|---|
| Free (current) | 3 | **1** | 3,000 | **100** | $0 |
| Pro | 10 | 8 | 50,000 | none | $20/mo |
| Pro + domains add-on | 110 | 108 | 50,000 | none | $40/mo |
| Scale | 1,000 | 998 | 100,000 | none | $90/mo |

**Recommendation: Pro ($20/mo) is needed before the first real gym sends
anything at all**, daily cap first and domains second. The domains add-on
(+100 for $20/mo) is not needed until customer nine. This is the first genuine
recurring cost the product cannot avoid, and it is small — but it must be
spent before Track C/D can mean anything, because today a verification pass
would hit the 100/day wall rather than testing casdey.

**The cold outreach shares this quota — decided 2026-09-04.** The live gym
outreach routine sends through the *same* Resend account (`davide@casdey.com`
on the root `casdey.com` domain). Measured volume from Resend's own API:

```
2026-09-04  75      2026-09-02  50
2026-09-03  75      ...50/day back through August
```

75 of 100 a day, and ~2,250 of 3,000 a month. Not throttled today, but with
25 emails/day of headroom, and **product sends and outreach sends draw on one
pool**. A single gym running a win-back to 200 lapsed members would consume the
outreach's entire day: the first customer would silently stop the thing that
finds customers.

Davide's call: build the features first, subscribe later. So the trigger is
**not** "V1 published" — it is **whichever comes first**:
1. the first gym sends a real campaign, or
2. outreach volume goes above ~90/day (the growth plan wants it higher, and
   100/day is a hard ceiling on Free, so this may well arrive first).

**G1b. A 403 from Resend means two different things.** The first cut of the
error mapping treated every 401/403 as "this key may not manage domains", so
the plan limit above surfaced to the gym as "sending from your own domain is
not switched on for this deployment" — wrong cause, wrong remedy. Now split by
Resend's `name` field: `restricted_api_key` (or any 401) is the key error,
`403` + "domain limit" is `ResendDomainLimitError` with its own message.

**Still unproven:** verification has never returned `verified` for a gym
domain. `testgym.casdey.com` sat `pending` for ~50 minutes with all three DNS
records provably correct in public DNS. It is a subdomain of `casdey.com`,
which is already verified on the same account, and that overlap is the likely
cause — so this needs retrying on an unrelated domain before anything is read
into it.

**Also noted:** per-gym sending appears nowhere in onboarding. The "Finish
setting up" checklist has five items and Sending is not one of them, so the
feature is invisible unless a gym digs into Settings.

- `src/lib/email/domains.ts` wraps Resend's Domains API (create / verify /
  get / delete) plus strict input normalising. **Resend verifies the domain,
  not casdey** — it only proves whoever set it up controls that DNS. There is
  no business-entity requirement anywhere in this flow, which is exactly why
  the email half could ship immediately while WhatsApp waits on Meta.
- `src/lib/email/identity.ts` holds the one rule that decides the From address,
  deliberately **not** `server-only` so the campaign editor previews the same
  answer the sender will use.
- **Only `verified` is used.** `pending` behaves exactly like "not set up",
  which is the point of checking status rather than presence: the row has a
  domain the moment setup starts, but DNS may be hours away, and unauthenticated
  mail on the gym's own domain is punished harder than mail from casdey's — and
  it burns a reputation belonging to the customer.
- Settings → **Sending**: connect a domain, see the DNS records to add, re-check,
  disconnect. Falls back cleanly, so a gym with no domain still sends under its
  own name exactly as before.
- `OutgoingEmail` gained `fromAddress`; all three member-facing send sites pass
  it (queue drain, campaign self-test, booking confirmation). The gym-facing
  new-booking notice still comes from casdey, correctly — that one *is* casdey
  talking.

### G2. WhatsApp from the gym's own number — `done 2026-09-04 (code)`
- `gyms.whatsapp_from` replaces the single shared `TWILIO_WHATSAPP_FROM`.
  `whatsappProvider(from)` now **cannot be constructed without naming a
  sender**; null degrades to a provider that errors clearly.
- Settings → WhatsApp gained the number field, and its copy no longer describes
  a shared casdey number, because there isn't one.
- **This also fixed a real routing bug**, not just branding. The inbound webhook
  used to pick the most recently active conversation for a phone number, with a
  documented edge case: a member of two gyms had replies attached to whichever
  gym messaged them last. Each gym now having its own number means Twilio's
  inbound `To` identifies the gym exactly, so routing is scoped to it. The
  unscoped lookup remains as a fallback for pre-`0017` conversations.

### G3. What is NOT solved, and the honest limit
Onboarding a gym's WhatsApp is **manual**. The gym does Meta's "Continue with
Facebook" step with their own Meta Business account and their own number, which
links their WABA into casdey's Twilio account as a separate sender, and their
opener template is approved under **their** WABA (so templates do not carry
across gyms).

The self-serve version is Meta's **Embedded Signup** via Twilio's **Tech
Provider programme** — free, no minimum volume, up to 200 new customers per
rolling 7 days. Two reasons it is not V1:
1. **3-4 weeks** for Meta app approval plus Twilio linking, before any code.
2. It requires **Meta Business Verification of casdey**, which needs a
   registered legal entity. There is no Partita IVA, and Davide's position
   (2026-09-04) is that there will not be one until the business earns it.

Manual onboarding is the right answer while there are zero customers: scaling
onboarding is not the problem to solve today. Revisit Tech Provider when manual
onboarding starts hurting, which is a good problem to have.

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
- **WhatsApp (E1) and LegitFit sync (E2) are now V1** (rescoped 2026-09-03).
  E1 is firm and code-complete. **E2 exited to V2 on 2026-09-04** — B9 is
  closed: LegitFit has no authorisable export path, so CSV (A3) is V1's.
- **3-tier pricing (Track F) is now V1** (rescoped 2026-09-03). Entirely
  blocked on F0 (Davide's tier sheet); no F work starts before it. F must be
  green before Track C signs off Stripe (C1).
- **Brand identity refresh is done** (`f524f86`, 2026-09-04), unparked ahead of
  D once Davide gave the direction. It was never a V1 blocker; it just stopped
  being a reason to hold back.
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
| B4 | Source real Mindbody/Glofox/TeamUp/ABC **+ LegitFit** CSVs | Davide | todo — LegitFit is now the priority one (JD's platform, and CSV is its only path) |
| B5 | Confirm Vercel plan; revert cron if Pro | Davide | done — Hobby |
| B6 | Delete stray empty Vercel project "web" | Davide | done — removed, only `casdey` remains |
| B7 | Decide Free-plan limits shape | Davide | done (→ A8) |
| B8 | Upgrade Twilio account (blocks E1 prod send) | Davide | done 2026-09-04 — Trial→Full verified via API, $20 balance; Vercel has SID/TOKEN/ANTHROPIC. E1 prod send now gated on a Meta-approved sender + templates, not billing |
| B9 | Confirm JD's gym software + API access (feeds E2) | Davide | closed 2026-09-04 — LegitFit, no developer API, Zapier is trigger-only → E2 to V2 |
| E1 | WhatsApp channel + AI reply loop — revive for gym | me | code done + 0014 applied 2026-09-03; prod verify + B8 left |
| E2 | Direct LegitFit member sync | me | **exits to V2** 2026-09-04 — no API, and Zapier triggers cannot backfill the historical members casdey needs; CSV (A3) is the V1 path |
| F0 | 3-tier definitions (prices, capability split, discount/mapping) | Davide | done 2026-09-03 — Standard €99 / Pro €289; caps 200 / 2,000; WhatsApp + guarantee Pro-only; flat 20% early-adopter |
| F1 | Plan model: 4-plan capabilities, caps 50/200/2000, gates wired | me | code done 2026-09-03 |
| F2 | Stripe: tier-aware stripe.ts + 8-price setup script | me + Davide | done 2026-09-04 — live catalogue created, 9 vars set in Vercel, 6 retired ones removed, verified by `check:stripe`; test-mode set still owed (needs Davide's test key) |
| F3 | Checkout tier param + 3-tier billing UI | me | code done 2026-09-03 |
| F4 | Guarantee Pro-gated; 20% coupon currency-agnostic | me | code done 2026-09-03 |
| F5 | Plan copy / FAQ / upgrade prompts for three tiers | me | done 2026-09-03 |
| F6 | Tests: 4-plan capability matrix + price→tier mapping | me | done 2026-09-04 — `stripe.test.ts` added; found + fixed the silent Standard→Pro over-grant |
| C1 | Live-mode Stripe checkout + refund in prod | both | todo |
| C2 | Real Resend campaign send in prod | both | todo |
| C3 | Calendar booking end-to-end in prod | both | todo |
| C4 | Every wizard step verified in prod | both | todo |
| G1 | Email from the gym's own domain (Resend per-gym) | me | code + UI done 2026-09-04, admin key live. **Verification never yet observed** — retry on a domain unrelated to casdey.com |
| G1a | **Upgrade Resend to Pro ($20/mo)** | Davide | deferred by decision 2026-09-04. Free caps at 100/day, 3 domains (= 1 gym); outreach already uses 75/day of the *same* pool. Trigger: first gym campaign, or outreach >90/day |
| G2 | WhatsApp from the gym's own number | me | done 2026-09-04 (code) — `gyms.whatsapp_from`; also fixed the inbound routing ambiguity |
| G3 | Self-serve WhatsApp onboarding (Meta Embedded Signup) | me | **V2** — needs Tech Provider, which needs Meta business verification, which needs a legal entity |
| D1 | Davide's uninterrupted self-serve walkthrough | Davide | todo — final gate |

Update this board as items move. This doc is the pointer target from
`CLAUDE.md`, `SAAS_ROADMAP.md`, and `SAAS_ONBOARDING.md`.
