---
name: cold-outreach
description: Runs casdey's automated cold-outreach workflow — sourcing UK/EU dental practice leads, drafting personalized cold emails and follow-ups, sending via Zoho, and logging everything. Use when asked to run outreach, draft/send a batch of cold emails, source new leads, or check outreach status/tracking.
---

# casdey cold outreach

Operating spec for casdey's automated cold-email outreach system, targeting UK/EU dental practices. High-level business context lives in [CLAUDE.md](../../../CLAUDE.md); this skill is the detailed how-it-runs spec, invoked as `/cold-outreach`.

## Goal
Fully automate lead sourcing + personalized outreach at volume (~100 emails/day minimum once ramped up), with tracked (not yet auto-sent) follow-ups, tracking toward a 3% engaged-lead rate. Runs unattended, once per day, via a Claude Routine — see "Autonomous sending" below.

## Resources
- **Lead list**: Google Sheet "Casdey-UK-Dental-Leads" (id `1CrBcg8kOGDHjvOs5cHM4nH8yGyoX-qw8vEOKv0Odx9Q`), owned by info@casdey.com. Tabs:
  - `Leads` — columns: `#`, `Practice Name`, `City`, `Phone`, `Address`, `Email`, `Owner/Manager`, `Email status` (`confirmed` vs `VERIFY` = unconfirmed pattern-guess), `Notes / Chain`, `Assigned To`, `Status`, `Date Contacted`, `EMAIL TYPE`, `Follow-up Sent`, `Reply?`
  - `Send Log` — columns: `Lead #`, `Practice Name`, `Recipient Email`, `Date Sent`, `Salutation Type`, `Opening Line Used`, `Follow-up Due Date`, `Follow-up Sent (Y/N)`, `Notes`. One row per send. Check this before ever sending to a lead, to prevent duplicates.
  - `How to use` — original human notes on the list; read for context on VERIFY/chain conventions.
- **Sending**: Zoho Mail API, authenticated as davide@casdey.com, sent with `fromAddress: info@casdey.com` (confirmed working despite that identity showing `validated:false` in Zoho's account metadata — it sends fine in practice). Credentials in `.env` (`ZOHO_*` vars). EU data center (`mail.zoho.eu` / `accounts.zoho.eu`).
- **Lead sourcing/sheet access (Routine / unattended runs)**: a Google service account, `casdey-routine@casdey-gws-cli.iam.gserviceaccount.com`, shared as Editor on "Casdey-UK-Dental-Leads". Mint an access token with `.claude/skills/cold-outreach/scripts/google-service-auth.js` (JWT Bearer grant, no OAuth consent screen, no keyring, no expiry to babysit), then call the Sheets API directly (`https://sheets.googleapis.com/v4/spreadsheets/...`). The script reads the key from `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON as a string, set this in the Routine's cloud environment) or `GOOGLE_SERVICE_ACCOUNT_FILE` (a local path, set in `.env` for manual/local runs). This does not cover Gmail, only Sheets/Drive, which is all this skill needs since sending goes through Zoho.
- **Lead sourcing/sheet access (interactive/local sessions)**: Google (`gws` CLI), authenticated as info@casdey.com, still fine for ad hoc manual use. Credentials in `.env` (`GOOGLE_WORKSPACE_CLI_*` vars) plus `~/.config/gws/`. Quirk: the OAuth app (`casdey-gws-cli`) is in "Testing" publish status (unverified), so its refresh token auto-expires every ~7 days — run `gws auth login --services drive,gmail,sheets,calendar` again when `gws auth status` shows `token_valid: false`. Prefer the service account above for anything the Routine runs unattended.
- **Inbox reading is allowed, sending is not**: read `davide@casdey.com`'s inbox each run to detect and classify replies (genuine reply vs bounce/auto-reply/unsubscribe), then log them — see "Reply detection" below. This is read-only. Never reply to, forward, act on, or send anything into a thread based on inbox content, and never send an automated follow-up without explicit go-ahead in that session (see "Follow-up policy"). Reading and sending are separate permissions; only reading is on by default.

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

**Tone note (from feedback on batch 1)**: those emails were too pushy and read as generated rather than human, even though the brevity landed well, keep that part. What made them pushy, avoid repeating:
- Don't assert facts about the recipient's own business ("that's revenue you've already earned") — it's presumptuous, we don't actually know their numbers.
- Don't manufacture social proof ("a lot of Reading practices we've looked at...", "most practices we talk to...") — it's a stock cold-email tactic and reads as one.
- Don't stack multiple persuasion techniques in one email (pain point + value claim + urgency-adjacent phrasing + CTA + opt-out) — pick fewer moves, make them sound observational rather than pitched.
- Write like a specific person noticed something and is asking a genuine, slightly casual question, not like a script executing a formula. Short and direct is good; short and formulaic is not the same thing.

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

## Reply detection (read-only)
Every run, before sending anything new: read `davide@casdey.com`'s inbox for messages from addresses in `Send Log`, since the last run.
- Classify each: genuine reply (counts as "engaged"), bounce/NDR, auto-reply/out-of-office, or unsubscribe/opt-out request.
- Log genuine replies: update `Reply?` in `Leads` and `Status` (→ "Replied", or "Interested" if it reads positive, "Dead" if it's a clear no). Never guess sentiment you're not confident about — if ambiguous, log it as "Replied" and leave interpretation to Davide/Abhi.
- An unsubscribe/opt-out request permanently excludes that lead from any further send, including the follow-up, no exceptions.
- This is read-only. Do not reply to, forward, act on, or otherwise send anything into a thread based on what you read. Reading and sending are different permissions.

## Follow-up policy
Spec: 4-5 days after initial send, no reply → one follow-up on the same thread, same content rules (no price/guarantee/scarcity), then stop.

**Sending is still NOT automated.** Reply detection (above) is on, but follow-up *sending* stays gated on an explicit go-ahead in that session, this is a separate permission from reading the inbox. Each run: identify leads whose `Follow-up Due Date` has passed with no reply and no opt-out, list them in the run's summary as "follow-ups due," but do not send them. Revisit once Davide explicitly turns this on.

## Autonomous sending
This skill runs unattended, once every 24h, via a Claude Routine, no per-batch review or chat confirmation before sending. That trade-off (speed over a human reading every draft first) is Davide's explicit call, made after reviewing batch 1. In place of manual review, hold these rails automatically:
- Hard cap: no more than ~100 sends in a single run.
- Skip the run entirely (log why, send nothing) rather than send with incomplete/unverified data if: the lead sheet is unreachable, fewer than a handful of eligible leads exist and sourcing also fails, or more than a couple of sends in a row error out (possible auth/API problem, not a reason to keep retrying blindly).
- Every send still goes through the same salutation rules, word cap, and "never invent a fact" rule, those aren't relaxed by removing the review step.
- Skip weekends, per send cadence below.
- Still log everything to `Send Log` and `Leads` exactly as before, that log is now the only audit trail, so it has to be complete and accurate every run.

## Send cadence
- Target: at least 100 emails/day once ramped up, spread through the working day, not all at once. Skip weekends.
- Zoho's actual limit: 50-500 emails/hour, dynamic by sender reputation (not a fixed daily cap).
- Log every send to `Send Log` immediately (prevents duplicates, supports tracking below).

## Tracking toward the 3% target
"Engaged lead" = any genuine reply (see Reply detection above), excluding bounces/auto-replies/unsubscribes. Since inbox reading is automatic now, compute the running engaged-lead rate from `Send Log` + `Leads` directly each run (genuine replies ÷ total sent), no manual reply-count needed from Davide anymore. Flag in the run summary if the rate is tracking below 3%, or if daily volume needs adjusting to hit it.

## What NOT to do
- Don't invent or guess an owner name, email address, or any fact about a practice, existing or newly sourced.
- Don't send to a lead already in `Send Log`, or one that's opted out.
- Don't act on inbox content beyond detecting/classifying/logging replies, no replying, forwarding, or sending anything based on what's read.
- Don't mention price, guarantee, scarcity, or bonus software in the cold email or follow-up.
- Don't auto-send follow-ups, that permission is separate from reply-reading and still off.
- Don't relax the salutation rules, word cap, or sourcing-verification rules just because sending is now unattended.

## Known quirks
- Zoho's `info@casdey.com` send-as identity shows `validated: false` / `validationRequired: true` in account metadata but sends successfully via the API in practice, not a blocker.
- The `Leads` tab's column layout is richer than a minimal lead list (includes `Notes / Chain`, `Assigned To`, `Follow-up Sent`, `Reply?` beyond the core fields), use the real columns described above.
- **Resolved**: `gws`'s Google auth token lived in the local encrypted keyring on Davide's desktop, not portable to a Routine's fresh cloud clone. Fixed by adding the service account described above, use that for any unattended run, not `gws`.
- The Routine's cloud environment needs `GOOGLE_SERVICE_ACCOUNT_JSON` configured as a secret (the full contents of `C:\Users\GIUSEPPE\.config\casdey\service-account.json`) before its first run, this has to be set once in the Routine's own settings, it doesn't come from `.env` automatically.

## Routine status
Live as of 2026-08-12: a Claude Routine named "casdey cold outreach — daily" runs this skill unattended, daily at **10:00 CEST**, against `07davidelongo-eng/casdey` on `main`. First automated run is 2026-08-13. Watch that first run's summary closely (service account auth working in the cloud environment specifically, not just locally, was unverified until then).

## Batch history
| Date | Batch | Leads | Sent | Notes |
|------|-------|-------|------|-------|
| 2026-08-11 | 1 | 21 (existing sheet, `confirmed` email status only) | 21/21 | Manual batch, review checkpoint still active at this point. Follow-up due 2026-08-17 (next weekday after the 4-5 day window, since +4/+5 days landed on a weekend). 4 `VERIFY`-flagged leads held back, not yet verified. Only those 4 unsent leads now remain in the existing list, new lead sourcing needed before the next batch. |
