# casdey

Note: "casdey" is always written lowercase, including at the start of a sentence — never capitalized.

## Project structure
- `CLAUDE.md` — project context and conventions: business context, decisions, pricing, outreach status, and working conventions (everything else in this file).
- `.claude/` — Claude Code's own project configuration: subagents, skills, settings, and any tooling config specific to this project. The cold-outreach automation workflow lives at `.claude/skills/cold-outreach/` (invoke with `/cold-outreach`) — read that skill before touching outreach automation.
- `brand assets/` — brand identity files (logo, colors, fonts, etc.).

## Business overview
- Company name: casdey (always lowercase) — deliberately generic, not tied to any specific product, so the business can pivot without changing identity/domain/email.
- Current product: a SaaS tool for dormant-patient reactivation in dental practices. It finds patients who came once or twice and never rebooked, and re-engages them automatically to drive rebookings.
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

We are currently in Stage 1 — outreach actively underway, product not yet built.

## Stage 1 progress — outreach underway
- A lead list of 100 UK dental practices exists in a Google Sheet (owned by info@casdey.com), sourced mainly via localdentist.org.uk, with confirmed emails pulled from practice websites (not guessed patterns) and owner/principal dentist names researched for independents (~22 confirmed named owners).
- The first 50 cold emails have already been sent using the original outreach template.
- The remaining 50 are going out as a genuine A/B test: same offer, different subject line and opening angle, to compare response rates.
- Lead tracking uses these statuses: Not contacted / Contacted / Replied / Interested / Committed / Dead. Only "Committed" (a written "I'll pay £X") counts toward the 1-3 commitments needed before building.
- Follow-up sequence per lead: send message → if no reply in 4-5 days → ONE follow-up → then stop.
- Independent practices are prioritized over small chains — they decide faster.

## Outreach copy conventions
- The key opener question: "of the day-to-day admin your practice software handles, what's the one thing it doesn't do well?"
- Guarantee wording: "if it doesn't recover more than it costs, you don't pay."
- Cold emails are sent in plain text — no logo, no image attachments (spam risk).
- "casdey.com" is NOT included in the email signature yet, since there's no live website to point to.
- Supporting docs already created: a 4-email outreach sequence and a one-page Service Agreement (used once a prospect says they're interested, sent for signature).
- **Never use em dashes (—) as punctuation** (as a substitute for commas/parentheses/asides) in any casdey copy — cold emails, follow-ups, this file, anything. Use commas or separate sentences instead. Normal hyphens in compound words (follow-up, list-building, drop-off) are fine and unaffected by this rule.
- Email sign-off format: `Davide @casdey` (single line, no line break between name and company, no "Best,"/"Regards," preamble).

## Infrastructure already in place
- Domain: casdey.com, registered at GoDaddy.
- Email: Zoho Mail (free plan), not Google Workspace — blocked there due to no Partita IVA yet. MX/SPF/DKIM configured and verified.
- Two users: davide@casdey.com (me) and abhi@casdey.com (business partner).
- info@casdey.com is a shared Group (not an alias) — mail delivered to both our inboxes, both can send from it. Zoho treats it as a group, not a mailbox: it has no API/IMAP account of its own, so programmatic access goes through davide@casdey.com's account using send-as.
- Google Workspace signup for casdey.com is still blocked (no P.IVA), but info@casdey.com does have a plain Google Account (likely a byproduct of the earlier interrupted signup attempt) — this is what the `gws` CLI and Google Sheets/Drive access authenticate as.
- Stripe: connected in test mode only (account acct_1Tz17NDGwemFDmSP) — no live keys yet, no real charges possible. Hosting and other internal tracking tools still to be decided.

## Legal/tax context (Italy)
- No Partita IVA yet — first clients will be invoiced via prestazione occasionale.
- Partita IVA to be registered once revenue is consistent (regime forfettario).
