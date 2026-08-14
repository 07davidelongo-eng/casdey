# casdey SaaS — fixes & features roadmap

Davide's list of software fixes/features to tackle before V1, dictated
2026-08-14. Captured verbatim-in-intent here so it persists; we work these one
at a time (or in small batches), not all at once. Current build state is in
`SAAS_HANDOFF.md`; the offer model is in `src/lib/plan.ts`.

Status key: `todo` / `in progress` / `done`. Update as we go.

---

## 1. AI-assisted message writing + language selection — `built, needs key`
The campaign message should be creatable two ways: **manually** (as today) or
**with AI**, inside the platform. Keep the current default template as the
manual default. Add a **language selector** for the message.

**Built 2026-08-14:**
- New campaign form has a "Start from the template / Draft with AI" toggle and a
  **language selector** (7 markets: en/nl/de/fr/es/pt/it), defaulted from the
  practice's country (`src/lib/languages.ts`). Manual template stays the default.
- "Draft with AI" calls `generateDraftAction` → `src/lib/ai.ts`
  (`generateCampaignDraft`), which uses `@anthropic-ai/sdk`, structured output
  (`output_config.format` json_schema) at `effort: low`, a system prompt encoding
  casdey's copy rules (no em dashes, plain text, one ask, merge fields left in,
  no unsubscribe line), and writes in the selected language. Returns subject +
  body, fills the editable fields.
- `campaigns.language` column added (migration `0006`, applied to live DB) and
  stored on create; `Campaign.language` type added.
- Verified: tsc / lint / test (59/59) / build clean; toggle, language select, and
  the AI panel render; the click→server-action path works end to end (confirmed
  in-browser — with no key it returns the graceful "not switched on" message).

**Blocked on you (like #6):** the live AI call needs `ANTHROPIC_API_KEY` in the
app env (`web/.env.local` locally, Vercel for prod). Model defaults to
`claude-opus-5`; override with `CASDEY_AI_MODEL` (e.g. a cheaper Haiku/Sonnet)
once volume and cost are known. No key = drafting is unavailable and the practice
just writes manually; nothing else breaks.

**Not yet built (possible follow-ups):** translating the *manual* default
template into the 7 languages (today the manual default stays English; AI drafts
in-language). Editing an existing campaign's language/AI-redraft (this is the
new-campaign flow only).

## 2. WhatsApp channel with a responsive AI agent — `todo`
Add WhatsApp as a contact channel alongside email. Here the AI must be
**responsive and personalized**, behaving like a chatbot: it holds a real
back-and-forth with the patient, not a single templated send.
- Touches: WhatsApp Business API (provider TBD, e.g. Twilio/360dialog), inbound
  webhook, conversation state, AI reply loop, booking hand-off.
- Big; standalone channel work. Depends on send infra being solid (#6).

## 3. Google sign-in — `todo`
Wire up the Google login button (already stubbed). Needs a Google OAuth client
configured in Supabase → Auth → Providers → Google + callback URL registered.
- Small; already scoped in `SAAS_HANDOFF.md`.

## 4. Client self-test of the outreach — `todo`
The practice can **test the outreach on themselves**: receive the email or
WhatsApp message and walk through the patient's experience end to end (incl.
reply → booking) before sending to real patients.
- Depends on #6 (email) and #2 (WhatsApp) working. Medium.

## 5. Support chatbot for casdey itself — `todo`
A support chat widget bottom-right of the app (like most SaaS today), for the
**practice** to get help using casdey. Distinct from #2 (which talks to
patients).
- Standalone; medium.

## 6. Fix the send issue — `todo` (diagnosed)
Campaign email currently sends through casdey's own Zoho account, which can't
set a per-practice reply-to and trips Zoho's abuse limits (it's the same
account cold-outreach uses). Fix = wire up **Resend** (`RESEND_API_KEY` +
verified casdey.com sending domain) so patients see the practice's name and
replies land in the practice's inbox. Full detail in `SAAS_HANDOFF.md`
("Go-live blocker").
- Concrete, already diagnosed. **Blocks #4.** Good first pick.

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

## 8. Make the profit-or-nothing guarantee actually work — `todo`
Two halves:
  **(a) Refund mechanism.** If the guarantee is invoked, the refund actually
      happens (Stripe refund path).
  **(b) Eligibility / anti-abuse gating.** The practice must do the required
      work before the guarantee clock starts, so they can't claim a refund
      without genuinely running casdey:
        1. Upgrade to Premium.
        2. Fill in the patient list.
        3. Actually start a campaign.
      The **30-day guarantee window starts only when the campaign starts**
      (that's when real work begins), not at signup or upgrade. At day 30, if
      the required results aren't met, they can request the guarantee/refund.
- Depends on #7 (need revenue-made to know if the guarantee threshold was hit)
  and on live billing. Also needs the results threshold defined (open question).
- Largest item; do after #7 and live Stripe.

---

## Suggested sequencing (not locked)
1. **#6 send fix** — unblocks everything channel-related and #4; already diagnosed.
2. **#3 Google login** — small, closes a known gap.
3. **#7 price list + revenue** — foundation the guarantee (#8) needs.
4. **#8 guarantee** — refund + eligibility gating, after #7 + live billing.
5. **#1 AI message + language**, **#2 WhatsApp AI agent**, **#5 support chatbot**,
   **#4 self-test** — feature-add track, sequence by appetite.

## Open questions to pin down as we go
- #8: what exactly are "the required results" that decide whether the guarantee
  pays out? (revenue ≥ subscription cost, per CLAUDE.md, but confirm the number
  and how partial months count.)
- #1/#2: which AI model/provider for message generation and the WhatsApp agent.
- #2: which WhatsApp Business API provider.
- #7: where do prices come from — manual entry, or read from practice software?
