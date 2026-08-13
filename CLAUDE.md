# casdey

Note: "casdey" is always written lowercase, including at the start of a sentence — never capitalized.

## Project structure
- `CLAUDE.md` — project context and conventions: business context, decisions, pricing, outreach status, and working conventions (everything else in this file).
- `.claude/` — Claude Code's own project configuration: subagents, skills, settings, and any tooling config specific to this project. `.claude/launch.json` starts the local dev server for the browser preview tool. Skills of note:
  - `.claude/skills/cold-outreach/` (invoke with `/cold-outreach`) — read before touching outreach automation. Its `SKILL.md` is the detailed operating spec (environment detection, credentials, salutation rules, batch history); this file only carries the high-level status.
  - `.claude/skills/frontend-design/` — required reading before any frontend/visual work, see `brand assets/CLAUDE_DESIGN.md` for the accompanying screenshot-driven review workflow.
- `brand assets/` — brand identity. `casdey-brand-guide.html` (v2, Aug 2026) is the source of truth for colors, type and voice; everything visual must match it, and its tokens are mirrored in `web/src/app/globals.css`. `CLAUDE_DESIGN.md` is Davide's own frontend workflow rules (screenshot-compare against references, brand-asset-first, anti-generic guardrails). `landing page inspiration for casdey.webp` is the reference the current design was built from (Finpay-style fintech layout, adapted with casdey's own palette/copy/illustrations, not copied verbatim).
- `web/` — the casdey website: landing page (`/`), waitlist (`/waitlist`), and eventually the SaaS itself in the same app (Next.js 16 App Router + Tailwind v4, deployed on Vercel with root directory `web`). Waitlist signups are stored in Supabase (EU region). See `web/README.md` for setup, env vars, the waitlist mechanics, and two Supabase gotchas already hit once (bare project URL, explicit `service_role` table grants).

## Business overview
- Company name: casdey (always lowercase) — deliberately generic, not tied to any specific product, so the business can pivot without changing identity/domain/email.
- Current product: a SaaS tool for dormant-patient reactivation in dental practices. It finds patients who came once or twice and never rebooked, re-engages them automatically, and handles the whole loop through to booking: replying in the practice's name and putting the appointment straight into the practice's calendar, not just flagging a reply for staff to action.
- Guarantee mechanics: the "profit or nothing" guarantee requires knowing revenue actually generated per practice, so casdey needs write access to the practice's calendar (to book) and read access to its price/treatment list (to value each booking), not just read access to patient records.
- Target market: dental practices, now expanded from UK-only to UK + EU (in addition to the original English-speaking-country target of UK, Ireland, USA). Pricing is quoted in GBP for UK and EUR for EU.
- Price (early flat rate, first outreach wave): £199/month.
- Price (current offer, used from the automated outreach system onward): £250/mo GBP or €290/mo EUR after the free trial week; £225/mo GBP or €262/mo EUR on an annual plan.
- Core validation rule: validate with real payments/commitments, not with polite interest. "Sounds useful" doesn't count — a deposit or explicit "I'll pay £X on launch" does.

## Data sensitivity — critical
This product will handle real dental patient data — health-adjacent personal data. GDPR compliance is a hard requirement for the UK/Ireland market, not optional. Treat any data handling, storage, or processing decisions with this in mind by default, and flag anything that could create compliance risk.

## The 5-stage plan
1. Outreach to test interest — no fixed message count; send as many as possible (me + my business partner Abhi) while staying out of spam. Flexible stage: if an idea gets no traction, we change it and repeat. Trigger to move on: 1-3 real paid commitments.
2. Build the SaaS and land first customers, with an offer + guarantee (e.g. money-back if they don't recover the cost). Outreach again, both to earlier interested contacts and new businesses.
3. Collect feedback from first customers, tweak Beta into a 1.0.
4. With 1.0, get testimonials/reviews from first customers (possibly in exchange for something), then push much more outreach. Paid ads stay on hold.
5. Once profit is sufficient (threshold still TBD), start paid ads for momentum.

We are running Stage 1 (outreach) and Stage 2 (build) in parallel: Davide made the explicit call on 2026-08-13 to start building the landing page, waitlist, and SaaS ahead of the plan's original 1-3-paid-commitments trigger, rather than waiting on outreach to convert first. Recorded here as a deliberate decision, not a plan change.

## Stage 1 progress — outreach underway
- A lead list of UK + EU dental practices exists in a Google Sheet ("Casdey-UK-Dental-Leads", owned by info@casdey.com), sourced from practice websites and directories (not guessed patterns), with owner/principal names researched for independents where confidently sourced.
- Outreach is now a fully automated daily system (a Claude Routine, see `.claude/skills/cold-outreach/SKILL.md`), not a manual batch send: it sources leads, drafts, sends via Zoho, detects replies, and logs everything to the sheet's `Send Log` tab, unattended, once per day, capped at ~100 sends/run.
- As of the last recorded batch (2026-08-13): 53 total sends across two batches, covering UK, Ireland, Netherlands, Germany, Portugal and Spain. Full batch-by-batch history is in `SKILL.md`, not duplicated here.
- Lead tracking uses these statuses: Not contacted / Contacted / Replied / Interested / Committed / Dead. Only "Committed" (a written "I'll pay £X") counts toward the 1-3 commitments the original plan called for, though building has now started regardless (see above).
- Follow-up sequence per lead: send message → if no reply in 4-5 days → ONE follow-up → then stop. Follow-up *sending* is still manual-only by explicit choice; reply detection is automatic.
- Independent practices are prioritized over small chains — they decide faster.

## Stage 2 progress — building
- Landing page (`/`) and waitlist (`/waitlist`) are built and working locally, brand v2 applied, copy follows the free-first-week-only rule (no price shown, per the outreach copy's own no-price-in-first-touch logic). Not yet deployed publicly; `casdey.com` still points at GoDaddy, not Vercel.
- Waitlist storage is a real Supabase (EU/Frankfurt) table, `waitlist_signups`, RLS on with only the server-side service role able to read/write. Verified end-to-end on 2026-08-13 with a real test signup (row written, both notification emails sent).
- The SaaS product itself (patient import, dormant-patient detection, messaging, Stripe billing, auth) has not been started. That's the next piece of work — see "Open questions" below before it begins, since it touches real patient data and needs the integration/MVP-scope decisions made deliberately, not guessed.
- GitHub repo: `07davidelongo-eng/casdey`, branch `main`. Not yet connected to Vercel.

## Outreach copy conventions
- The key opener question: "of the day-to-day admin your practice software handles, what's the one thing it doesn't do well?"
- Guarantee wording: "if it doesn't recover more than it costs, you don't pay."
- Cold emails are sent in plain text — no logo, no image attachments (spam risk).
- "casdey.com" is NOT included in the email signature yet. A website now exists (see `web/`) but is not yet publicly deployed, so there is still nothing live to point to. **TODO once it is deployed:** add the casdey.com link to the cold-outreach routine's email template (see `.claude/skills/cold-outreach/SKILL.md`).
- Supporting docs already created: a 4-email outreach sequence and a one-page Service Agreement (used once a prospect says they're interested, sent for signature).
- **Never use em dashes (—) as punctuation** (as a substitute for commas/parentheses/asides) in any casdey copy — cold emails, follow-ups, this file, anything. Use commas or separate sentences instead. Normal hyphens in compound words (follow-up, list-building, drop-off) are fine and unaffected by this rule.
- Email sign-off format: `Davide @casdey` (single line, no line break between name and company, no "Best,"/"Regards," preamble).

## Infrastructure already in place
- Domain: casdey.com, registered at GoDaddy.
- Email: Zoho Mail (free plan), not Google Workspace — blocked there due to no Partita IVA yet. MX/SPF/DKIM configured and verified.
- Two users: davide@casdey.com (me) and abhi@casdey.com (business partner).
- info@casdey.com is a shared Group (not an alias) — mail delivered to both our inboxes, both can send from it. Zoho treats it as a group, not a mailbox: it has no API/IMAP account of its own, so programmatic access goes through davide@casdey.com's account using send-as.
- Google Workspace signup for casdey.com is still blocked (no P.IVA), but info@casdey.com does have a plain Google Account (likely a byproduct of the earlier interrupted signup attempt) — this is what the `gws` CLI and Google Sheets/Drive access authenticate as. A separate Google service account (`casdey-routine@casdey-gws-cli.iam.gserviceaccount.com`) exists for unattended Sheets access from the outreach Routine, see `.claude/skills/cold-outreach/SKILL.md`.
- Stripe: connected in test mode only (account acct_1Tz17NDGwemFDmSP) — no live keys yet, no real charges possible. Not yet wired into the website or software.
- GitHub: `07davidelongo-eng/casdey`, branch `main`.
- Vercel: not yet set up. Plan is Root Directory `web`, `main` = production, other branches = preview URLs, so local (`localhost:3000`) → preview → production is the intended flow. `casdey.com` DNS still needs to move from GoDaddy once a Vercel project exists.
- Supabase: project `casdey`, region `eu-central-1` (Frankfurt), used so far for the waitlist (`waitlist_signups` table). Free tier. Will likely also hold the SaaS's own data once that's built, given it needs the same EU-residency guarantee.

## Legal/tax context (Italy)
- No Partita IVA yet — first clients will be invoiced via prestazione occasionale.
- Partita IVA to be registered once revenue is consistent (regime forfettario).

## Open questions before building the SaaS
Raised 2026-08-13, not yet answered. Building the product itself (not just the marketing site) touches real dental patient data and billing, so these are worth deciding deliberately rather than defaulting:
- MVP scope: does the first working version need a real practice-software integration (Dentally, SOE Exact, R4, Carestream, the four named on the landing page), or does it start with manual CSV/spreadsheet upload so it works for any practice regardless of software? This now also has to cover calendar write-access (to book appointments) and price-list read-access (to calculate revenue for the guarantee), not just read access to the patient list, since casdey's job extends through booking rather than stopping at alerting the practice.
- Auth: Supabase Auth (same project as the waitlist DB) vs. a dedicated provider (Clerk, NextAuth, etc.)?
- Billing flow: does Stripe capture a payment method at signup (charged automatically once the free week ends, matching the "profit or nothing" guarantee language), or stay card-free with manual invoicing after the trial (matching the no-P.IVA prestazione-occasionale reality for the first clients)?
- How the free-first-week promise already made in outreach copy and on the waitlist page actually gets fulfilled operationally once real signups arrive before the product is fully ready.
