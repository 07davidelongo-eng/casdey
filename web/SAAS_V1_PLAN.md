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

**Explicitly NOT in V1** (deferred to V2, do not let these expand scope):
WhatsApp channel revival (JD's signal), LegitFit / any real gym-software API
integration, the #10 win-back/comeback-offer interactive page, republishing the
public marketing homepage (invited-only signup does not need it).

---

## 1. Where things actually stand (2026-09-03)

- The **dental→gym pivot shipped and deployed** (commit `25af6aa` + ~12 after
  it on `main`; Vercel auto-deploys). Not "local only" as `SAAS_ROADMAP.md` /
  `SAAS_HANDOFF.md` still say.
- `/app`, `/login`, `/book/*`, `/u/*`, `/terms/*`, `/privacy` are **reachable in
  production** (invited-only; the marketing homepage `/` still redirects to
  `/waitlist`). Email + billing env vars are set in Vercel.
- **Outreach is live** (gym, 75 email/day + IG drafts) and producing engaged
  leads — they currently have nowhere polished to land. This is what makes V1
  urgent.
- Migrations exist through `0013`. **Whether `0011`/`0012`/`0013` are applied to
  the live DB is unconfirmed** (B3).
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
- **Still owed to Davide:** cross-check Vercel env vars (feeds B-track), confirm
  migration state (B3) and Vercel plan (B5).

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
- **Deferred (low priority, need more than code):** a true simultaneous
  *adjacent*-slot race can still book inside the buffer (the unique index only
  guards the identical slot; the fresh recompute covers the non-simultaneous
  case) — a proper fix needs a `tstzrange` exclusion constraint (migration).
  And reconciling casdey↔Google mirror desyncs (event deleted on Google out of
  band) needs a background job. Both fine to leave for post-V1; neither causes
  the double-booking the fail-open bug did.

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

### A9. Marketing landing copy — design review — `todo`
The gym-retargeted homepage copy was never design-reviewed against the
references in `brand assets`. Do a screenshot-compare pass (per
`CLAUDE_DESIGN.md`). Note: the homepage stays behind the `/waitlist` redirect
for V1, so this is polish, not a launch blocker — but do it before any decision
to republish.

### A10. Docs rewrite — `todo` — housekeeping, do last
Rewrite `SAAS_ROADMAP.md` and `SAAS_HANDOFF.md` into gym language and current
deployment reality. Fold their still-live items into this doc. Low urgency;
should not block Track C or D.

---

## 3. TRACK B — external / ops / decisions (Davide)

Run in parallel with Track A. **B1 is the long pole — start it first.**

### B1. Google OAuth consent screen — publish + verification — `todo` — **long pole**
Currently in "Testing" mode → only test users can sign in with Google, **and a
connected Calendar's refresh token dies after 7 days**. Needs: demo video of
the Calendar-connect flow, a 120×120 logo, the finalised scope (wait for A6),
then publish + submit. Google review runs **days to weeks** — this is why it
goes first. Gates: Google sign-in for real prospects, and Calendar booking in
prod.

### B2. Calendar env vars into Vercel — `todo` (after B1 clears + A6 done)
`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` (reuse the "casdey
web" OAuth client), `CALENDAR_TOKEN_KEY` (fresh AES-256). Until these are set,
Settings → Booking shows "not set up" and booking can't see/write Google.

### B3. Confirm migrations applied on live DB — `todo`
Confirm `0011` (dental→gym rename), `0012` (at-risk campaigns), `0013`
(cancellation reason) are applied to the live Supabase project — or give me
read access to check. Prod `/app` appearing to work *suggests* they're applied,
but it's unconfirmed.

### B4. Source real gym-platform CSV exports — `todo` (feeds A3)
Real member-export CSVs from Mindbody / Glofox / TeamUp / ABC Fitness — even one
or two each. Ask engaged leads (e.g. JD) for a sample export as part of the
onboarding conversation.

### B5. Confirm Vercel plan — `todo`
Hobby vs Pro is unconfirmed (a Hobby-only cron limit was hit 2026-08-19). If
Pro: revert the campaign-send cron in `vercel.json` from daily back to hourly.

### B6. Delete stray Vercel project — `todo`
An empty project named `web` (separate from `casdey`) was created by accident
during the 2026-08-19 deploy-pipeline fix. No deployments; delete it.

### B7. Decide Free-plan limits — `done 2026-09-03`
Davide chose **lock lapsed identities + cap members imported**. A8 built both.

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
When B1 clears ── B2 (calendar env vars into Vercel) ─────────────────────────┘
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
- V2 items (WhatsApp, LegitFit, #10 offer, homepage republish) do not enter any
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
| A6 | Calendar prod hardening (fail-closed, scope, re-auth) | me | mostly done; 2 items deferred |
| A7 | GDPR/legal re-audit for gym | me | done (postal address → Davide) |
| A8 | Free-plan limits implementation | me | done |
| A9 | Marketing landing design review | me | todo |
| A10 | Rewrite SAAS_ROADMAP + SAAS_HANDOFF | me | todo |
| B1 | Google OAuth consent screen: publish + verify | Davide | todo — long pole |
| B2 | Calendar env vars into Vercel | Davide | todo (after B1) |
| B3 | Confirm migrations 0011/0012/0013 on live DB | Davide | todo |
| B4 | Source real Mindbody/Glofox/TeamUp/ABC CSVs | Davide | todo |
| B5 | Confirm Vercel plan; revert cron if Pro | Davide | todo |
| B6 | Delete stray empty Vercel project "web" | Davide | todo |
| B7 | Decide Free-plan limits shape | Davide | done (→ A8) |
| C1 | Live-mode Stripe checkout + refund in prod | both | todo |
| C2 | Real Resend campaign send in prod | both | todo |
| C3 | Calendar booking end-to-end in prod | both | todo |
| C4 | Every wizard step verified in prod | both | todo |
| D1 | Davide's uninterrupted self-serve walkthrough | Davide | todo — final gate |

Update this board as items move. This doc is the pointer target from
`CLAUDE.md`, `SAAS_ROADMAP.md`, and `SAAS_ONBOARDING.md`.
