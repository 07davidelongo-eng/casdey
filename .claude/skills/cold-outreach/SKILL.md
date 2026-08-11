---
name: cold-outreach
description: Runs casdey's automated cold-outreach workflow — sourcing UK/EU dental practice leads, drafting personalized cold emails and follow-ups, sending via Zoho, and logging everything. Use when asked to run outreach, draft/send a batch of cold emails, source new leads, or check outreach status/tracking.
---

# casdey cold outreach

Operating spec for casdey's automated cold-email outreach system, targeting UK/EU dental practices. High-level business context lives in [CLAUDE.md](../../../CLAUDE.md); this skill is the detailed how-it-runs spec, invoked as `/cold-outreach`.

## Goal
Fully automate lead sourcing + personalized outreach at volume (~100 emails/day minimum once ramped up), with tracked (not yet auto-sent) follow-ups, tracking toward a 3% engaged-lead rate.

## Resources
- **Lead list**: Google Sheet "Casdey-UK-Dental-Leads" (id `1CrBcg8kOGDHjvOs5cHM4nH8yGyoX-qw8vEOKv0Odx9Q`), owned by info@casdey.com. Tabs:
  - `Leads` — columns: `#`, `Practice Name`, `City`, `Phone`, `Address`, `Email`, `Owner/Manager`, `Email status` (`confirmed` vs `VERIFY` = unconfirmed pattern-guess), `Notes / Chain`, `Assigned To`, `Status`, `Date Contacted`, `EMAIL TYPE`, `Follow-up Sent`, `Reply?`
  - `Send Log` — columns: `Lead #`, `Practice Name`, `Recipient Email`, `Date Sent`, `Salutation Type`, `Opening Line Used`, `Follow-up Due Date`, `Follow-up Sent (Y/N)`, `Notes`. One row per send. Check this before ever sending to a lead, to prevent duplicates.
  - `How to use` — original human notes on the list; read for context on VERIFY/chain conventions.
- **Sending**: Zoho Mail API, authenticated as davide@casdey.com, sent with `fromAddress: info@casdey.com` (confirmed working despite that identity showing `validated:false` in Zoho's account metadata — it sends fine in practice). Credentials in `.env` (`ZOHO_*` vars). EU data center (`mail.zoho.eu` / `accounts.zoho.eu`).
- **Lead sourcing/sheet access**: Google (`gws` CLI), authenticated as info@casdey.com. Credentials in `.env` (`GOOGLE_WORKSPACE_CLI_*` vars) plus `~/.config/gws/`. Quirk: the OAuth app (`casdey-gws-cli`) is in "Testing" publish status (unverified), so its refresh token auto-expires every ~7 days — run `gws auth login --services drive,gmail,sheets,calendar` again when `gws auth status` shows `token_valid: false`.
- **No inbox/reply access**: outreach sending and follow-up *scheduling* only. Never read, monitor, or summarize any inbox for replies — replies are reported manually by Davide/Abhi. This boundary holds even though the Zoho token technically has broad enough scope to read the inbox — don't use it that way.

## Lead sourcing — ongoing, not one-time
The list runs dry fast at volume. Before each day's send:
- Check remaining unsent leads (`Status` blank in `Leads` tab). If fewer than ~150 remain, source more before that day's batch.
- Source the same way the original list was built: real sources only (practice websites, CQC, verified directories) — never invent or guess an email address or owner name.
- Every new lead needs: Practice Name, City, Phone, Address, Email (confirmed from an actual source, mark `Email status` accordingly), Owner/Principal (name only if a clean confident source states it, otherwise "no named owner found" or "corporate/group").
- Dedupe against `Send Log` before adding — never re-add or re-contact someone already emailed.
- Append new leads to `Leads` with the same columns.
- Covers UK **and** EU practices.

## The cold email
First-touch email. The **only** offer element allowed in it: a free first week, no commitment. Never include price, guarantee, scarcity, or bonus software.

**Key points every cold email must hit** (any order/phrasing, no fixed template):
1. Real pain point: lapsed/one-time patients who never rebooked = lost revenue
2. What casdey does: reactivates those patients on the practice's behalf, no manual work, no ad spend
3. The offer: free first week, no commitment
4. Low-friction CTA: reply to learn more / start the free week
5. A one-line opt-out ("let me know if you'd rather I not follow up again," varied per email) — for PECR/GDPR risk reduction, especially now covering EU.

Under ~120 words, professional tone, no superlatives, no price/guarantee language. Vary structure, opening line, and phrasing per lead, should not read as mail-merged. Use whatever specific detail is available (city, NHS vs private, chain vs independent) naturally.

## Salutation rules (apply exactly, from the `Owner/Manager` column)
1. Blank/empty → "Dear Sir or Madam"
2. Contains "VERIFY", "verify", "no named owner found", "corporate", "group", or any hedge/uncertainty qualifier (e.g. "no single first name confirmed", "likely owner, verify") → "Dear [Practice Name] team" — never use a name from that cell even if one is present
3. Only use "Dear Dr [Surname]" when the field is a clean, confident single name with no qualifier
4. Always personalize [Practice Name] and [City]

## Style rules
- Never use em dashes (—) as punctuation (comma/aside substitute). Use commas or separate sentences. Normal hyphens in compound words (follow-up, list-building, drop-off) are fine.
- Sign-off: `Davide @casdey` — single line, no line break, no "Best,"/"Regards," preamble.
- Plain text only, no logos, no image attachments.

## The full offer (reference only — NEVER put this in a cold email or follow-up)
Everything below is held back for Davide/Abhi to walk a lead through manually once they reply positively:
- Price after the trial week: £250/mo GBP or €290/mo EUR. Annual: £225/mo GBP or €262/mo EUR.
- Guarantee ("Profit or nothing"): if casdey doesn't generate more revenue than the practice invested, 100% refund + free software until that condition is met.
- Scarcity: 13 spots left before the Q3 window closes.
- Bonus: software that generates the practice's own recontact-ready leads list.
- **Fulfillment note**: the SaaS isn't built yet (still being built "in the upcoming days" as of Aug 2026). If a practice says yes to the free week before it's ready, Davide/Abhi handle that manually, explaining the situation and offering a discount or gift to make up for the delay. This skill only ever logs the reply as "Interested" and stops — it never promises or arranges the trial itself, and never sends anything beyond the cold email and its one follow-up.

## Follow-up policy
Spec: 4-5 days after initial send, no reply → one automatic follow-up on the same thread, same content rules (no price/guarantee/scarcity), then stop.

**Current status: NOT automated.** Davide does not want follow-up sending automated yet (to avoid the system responding into live reply threads while reply-monitoring isn't in place). For now: track the follow-up due date in `Send Log` (`Follow-up Due Date` column), but never send a follow-up without explicit go-ahead in that session. Revisit once Davide confirms he's ready.

## Send cadence
- Target: at least 100 emails/day once ramped up, spread through the working day, not all at once. Skip weekends.
- Zoho's actual limit: 50-500 emails/hour, dynamic by sender reputation (not a fixed daily cap).
- Log every send to `Send Log` immediately (prevents duplicates, supports tracking below).

## Review checkpoint (currently active)
For now (first ~2 weeks, especially since content is generated per-lead, not templated): before sending each day's batch, draft the full set as a review file + summary table (recipient, salutation, opening line, personalization detail, and for new leads, where the data was sourced from). Flag anything low-confidence. Get explicit confirmation before sending. Only stop doing this once Davide explicitly says to switch to autonomous sending, and even then, sending real emails should get at minimum a per-batch go-ahead, not silent unattended execution indefinitely.

## Tracking toward the 3% target
"Engaged lead" = any reply that isn't a bounce/auto-reply/unsubscribe. No inbox access, so replies can't be detected automatically, Davide/Abhi report reply counts manually. Once given a count, calculate the running engaged-lead rate against `Send Log` totals and flag if daily volume needs adjusting to hit 3%.

## What NOT to do
- Don't invent or guess an owner name, email address, or any fact about a practice, existing or newly sourced.
- Don't send to a lead already in `Send Log`.
- Don't access, read, or summarize any inbox — sending, follow-up *scheduling*, and lead sourcing only.
- Don't mention price, guarantee, scarcity, or bonus software in the cold email or follow-up.
- Don't auto-send follow-ups until Davide explicitly turns that on.

## Known quirks
- Zoho's `info@casdey.com` send-as identity shows `validated: false` / `validationRequired: true` in account metadata but sends successfully via the API in practice, not a blocker.
- The `Leads` tab's column layout is richer than a minimal lead list (includes `Notes / Chain`, `Assigned To`, `Follow-up Sent`, `Reply?` beyond the core fields), use the real columns described above.

## Batch history
| Date | Batch | Leads | Sent | Notes |
|------|-------|-------|------|-------|
| 2026-08-11 | 1 | 21 (existing sheet, `confirmed` email status only) | 21/21 | Follow-up due 2026-08-17 (next weekday after the 4-5 day window, since +4/+5 days landed on a weekend). 4 `VERIFY`-flagged leads held back, not yet verified. Only those 4 unsent leads now remain in the existing list, new lead sourcing needed before the next batch. |
