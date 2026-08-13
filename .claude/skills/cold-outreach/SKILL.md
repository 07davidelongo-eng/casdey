---
name: cold-outreach
description: Runs casdey's automated cold-outreach workflow — sourcing UK/EU dental practice leads, drafting personalized cold emails and follow-ups, sending via Zoho, and logging everything. Use when asked to run outreach, draft/send a batch of cold emails, source new leads, or check outreach status/tracking.
---

# casdey cold outreach

Operating spec for casdey's automated cold-email outreach system, targeting UK/EU dental practices. High-level business context lives in [CLAUDE.md](../../../CLAUDE.md); this skill is the detailed how-it-runs spec, invoked as `/cold-outreach`.

## Goal
Fully automate lead sourcing + personalized outreach at volume (~100 emails/day minimum once ramped up), with automated follow-ups (as of 2026-08-13, see "Follow-up policy"), tracking toward a 3% engaged-lead rate. Runs unattended, once per day, via a Claude Routine — see "Autonomous sending" below.

## Which environment am I running in?
Check this first, it changes which tools are usable:
- **Claude Routine (unattended, cloud)**: credentials already exist as real process environment variables (`ZOHO_*`, `GOOGLE_SERVICE_ACCOUNT_JSON`), set directly in the Routine's own settings. There is no `.env` file, `.env` is gitignored and never gets pushed to GitHub, a fresh clone will never have it, don't look for it or treat its absence as a blocker. There is also no `gws` CLI and no local keyring, don't try to use `gws`, `gws auth status`, or anything under `~/.config/gws/` in this environment, none of it exists here. Read credentials straight from the environment (`process.env.ZOHO_CLIENT_ID`, `$ZOHO_CLIENT_ID`, etc.) and use the service account script below for Sheets.
- **Local/interactive session on Davide's desktop**: `.env` exists and `gws` is installed, either credential path works, see below.

## Resources
- **Lead list**: Google Sheet "Casdey-UK-Dental-Leads" (id `1CrBcg8kOGDHjvOs5cHM4nH8yGyoX-qw8vEOKv0Odx9Q`), owned by info@casdey.com. Tabs:
  - `Leads` — columns: `#`, `Practice Name`, `City`, `Phone`, `Address`, `Email`, `Owner/Manager`, `Email status` (`confirmed` vs `VERIFY` = unconfirmed pattern-guess), `Notes / Chain`, `Assigned To`, `Status`, `Date Contacted`, `EMAIL TYPE`, `Follow-up Sent`, `Reply?`
  - `Send Log` — columns: `Lead #`, `Practice Name`, `Recipient Email`, `Date Sent`, `Salutation Type`, `Opening Line Used`, `Follow-up Due Date`, `Follow-up Sent (Y/N)`, `Notes`. One row per send. Check this before ever sending to a lead, to prevent duplicates.
  - `How to use` — original human notes on the list; read for context on VERIFY/chain conventions.
- **Sending**: Zoho Mail API, authenticated as davide@casdey.com, sent with `fromAddress: info@casdey.com` (confirmed working despite that identity showing `validated:false` in Zoho's account metadata — it sends fine in practice). EU data center (`mail.zoho.eu` / `accounts.zoho.eu`). Credentials: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_ID`, `ZOHO_SEND_AS_INFO_ID`, `ZOHO_API_DOMAIN`, `ZOHO_ACCOUNTS_DOMAIN` — read these as environment variables directly (present already in a Routine run, or in `.env` for a local session, same variable names either way, no code branching needed). **Mint one Zoho access token at the start of the run and reuse it for every send and the reply-detection read** (it's valid ~1hr, plenty for a single run) — minting a fresh token per email hits Zoho's OAuth rate limit partway through a batch (happened in batch 2, self-recovered after ~2 min but slowed things down for no reason).
- **Lead sourcing/sheet access (Routine / unattended runs, and preferred generally)**: a Google service account, `casdey-routine@casdey-gws-cli.iam.gserviceaccount.com`, shared as Editor on "Casdey-UK-Dental-Leads". Mint an access token with `.claude/skills/cold-outreach/scripts/google-service-auth.js` (JWT Bearer grant, no OAuth consent screen, no keyring, no expiry to babysit), then call the Sheets API directly (`https://sheets.googleapis.com/v4/spreadsheets/...`). The script reads the key from the `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable (full JSON as a string) — that's how it's set in the Routine. For a local run where it's more convenient to point at a file instead, `GOOGLE_SERVICE_ACCOUNT_FILE` (a path) also works. This covers Sheets/Drive only, not Gmail, which is all this skill needs since sending goes through Zoho.
- **Lead sourcing/sheet access (local/interactive sessions only, optional alternative)**: Google (`gws` CLI), authenticated as info@casdey.com. Only usable on Davide's desktop, credentials in `.env` (`GOOGLE_WORKSPACE_CLI_*` vars) plus `~/.config/gws/`. Quirk: the OAuth app (`casdey-gws-cli`) is in "Testing" publish status (unverified), so its refresh token auto-expires every ~7 days. This does not exist in a Routine environment, use the service account above there, always.
- **Inbox reading and follow-up sending are both allowed**: read `davide@casdey.com`'s inbox each run to detect and classify replies (genuine reply vs bounce/auto-reply/unsubscribe), then log them — see "Reply detection" below. Inbox reading stays strictly read-only: never reply to, forward, or act on inbox content beyond detecting/classifying/logging. Separately, sending the one scheduled follow-up to a non-replying lead is now on by default as of 2026-08-13, per "Follow-up policy" below, per Davide's explicit go-ahead in chat that day.

## Lead sourcing — ongoing, not one-time
The list runs dry fast at volume. Before each day's send:
- Check remaining unsent leads (`Status` blank in `Leads` tab). If fewer than ~150 remain, source more before that day's batch.
- Source the same way the original list was built: real sources only (practice websites, CQC, verified directories) — never invent or guess an email address or owner name.
- Every new lead needs: Practice Name, City, Phone, Address, Email (confirmed from an actual source, mark `Email status` accordingly), Owner/Principal (name only if a clean confident source states it, otherwise "no named owner found" or "corporate/group").
- Dedupe against `Send Log` before adding — never re-add or re-contact someone already emailed.
- Append new leads to `Leads` with the same columns.
- Covers UK **and** EU practices.

## The cold email
First-touch email, sent during the pre-launch/beta phase while the SaaS is still being built (as of 2026-08-13). Offer elements now allowed in it (updated from Davide's direction that day): a free first week of the Premium plan once the software ships, dropping to a limited Free plan after that, and a lifetime discount of £50/mo GBP or €59/mo EUR off Premium if they later choose to upgrade, exclusive to people who join now during this window. Still never include the standard ongoing price, the "profit or nothing" guarantee wording, scarcity, or bonus software, those stay held back for the manual follow-through once someone replies positively (see "The full offer" below) — this update only changes what's allowed in the cold email itself.

**TODO for a later update, not now**: once the SaaS actually launches, this offer's framing needs to switch from "once the software ships" to "it's live now." Don't make that change until explicitly told the software has launched.

**Key points every cold email must hit** (any order/phrasing, no fixed template):
1. Real pain point: lapsed/one-time patients who never rebooked = lost revenue
2. What casdey does: reactivates those patients on the practice's behalf, no manual work, no ad spend
3. The offer: a free first week of Premium once the software ships, then a Free plan, then a lifetime £50/€59 discount if they choose to upgrade to Premium later, only available to people joining now
4. Explicit feedback framing, stated plainly: this isn't a sales pitch, casdey genuinely wants their feedback on the product before it's finished
5. The link: https://casdey.com/waitlist
6. Low-friction CTA: reply to learn more / join the waitlist
7. A one-line opt-out ("let me know if you'd rather I not follow up again," varied per email) — for PECR/GDPR risk reduction, especially now covering EU.

Under ~150 words (raised from ~120 to fit the extra offer detail without cramming, still tight). Professional tone, no superlatives, no standard-price/guarantee language. State the offer as one plain, clear idea rather than a bulleted pitch, don't stack it with other persuasion techniques on top (see the pushiness note from batch 1 feedback below, still fully in force), there is already more to say than before so keep everything else as minimal as it was. Vary structure, opening line, and phrasing per lead, should not read as mail-merged. Use whatever specific detail is available (city, NHS vs private, chain vs independent) naturally.

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
- Standard ongoing price, after the beta discount period: £250/mo GBP or €290/mo EUR. Annual: £225/mo GBP or €262/mo EUR.
- Guarantee ("Profit or nothing"): if casdey doesn't generate more revenue than the practice invested, 100% refund + free software until that condition is met.
- Scarcity: 13 spots left before the Q3 window closes.
- Bonus: software that generates the practice's own recontact-ready leads list.
- **Fulfillment note**: the SaaS isn't built yet (still being built "in the upcoming days" as of Aug 2026). If a practice says yes to the free week before it's ready, Davide/Abhi handle that manually, honouring what's already stated in the cold email (free week of Premium once it ships, then Free plan, then lifetime £50/€59 discount if they upgrade). This skill only ever logs the reply as "Interested" and stops, it never promises anything beyond what's already in the cold email, and never sends anything beyond the cold email and its one follow-up.
- **Offer window note**: the beta wrapper (free week, Free plan, lifetime discount) is specific to people who join during the waitlist/beta and V1 launch windows, not a standing offer. It retires for new leads once V2 ships; existing converts keep their lifetime discount. Not relevant to today's sends, keep this skill in sync if that transition is ever specified here.

## Reply detection (read-only)
**Mechanism: the Zoho Mail API, same credentials as sending, not a Gmail connector.** `davide@casdey.com` is hosted on Zoho, not Google, despite the domain looking generic. If this environment has a "Gmail" connector available, it is not the right tool and is very likely wired to a personal account, not the business one, ignore it entirely for this. Use `GET /api/accounts/{ZOHO_ACCOUNT_ID}/messages/view` (or equivalent search) against `ZOHO_API_DOMAIN`, the same auth flow already used for sending. If for some reason Zoho message-reading isn't reachable this run, skip reply detection and say so plainly in the summary, don't substitute a different mailbox.

Every run, before sending anything new: read `davide@casdey.com`'s inbox for messages from addresses in `Send Log`, since the last run.
- Classify each: genuine reply (counts as "engaged"), bounce/NDR, auto-reply/out-of-office, or unsubscribe/opt-out request.
- Log genuine replies: update `Reply?` in `Leads` and `Status` (→ "Replied", or "Interested" if it reads positive, "Dead" if it's a clear no). Never guess sentiment you're not confident about — if ambiguous, log it as "Replied" and leave interpretation to Davide/Abhi.
- An unsubscribe/opt-out request permanently excludes that lead from any further send, including the follow-up, no exceptions.
- This is read-only. Do not reply to, forward, act on, or otherwise send anything into a thread based on what you read. Reading and sending are different permissions.

## Follow-up policy
Spec: 4-5 days after initial send, no reply → one follow-up on the same thread, same content rules (no standard price/guarantee/scarcity/bonus software), then stop.

**Sending is now automated, as of 2026-08-13, per Davide's explicit go-ahead in chat that day.** Each run: identify leads whose `Follow-up Due Date` has passed with no reply and no opt-out, draft and send the one follow-up per lead (same content rules as the cold email, i.e. the beta offer + waitlist link included, still no standard price/guarantee/scarcity/bonus software, varied phrasing per lead, not a copy-paste of the first email), then mark `Follow-up Sent (Y/N)` → Y in `Send Log` and `Follow-up Sent` → Y in `Leads`. Still only ONE follow-up ever per lead.

## Autonomous sending
This skill runs unattended, once every 24h, via a Claude Routine, no per-batch review or chat confirmation before sending. That trade-off (speed over a human reading every draft first) is Davide's explicit call, made after reviewing batch 1. In place of manual review, hold these rails automatically:
- Hard cap: no more than ~100 sends in a single run, covering new cold emails and follow-ups combined, not just cold emails.
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
- Don't send more than one follow-up per lead, ever, even though follow-up sending is now on.
- Don't relax the salutation rules, word cap, or sourcing-verification rules just because sending is now unattended.

## Known quirks
- Zoho's `info@casdey.com` send-as identity shows `validated: false` / `validationRequired: true` in account metadata but sends successfully via the API in practice, not a blocker.
- The `Leads` tab's column layout is richer than a minimal lead list (includes `Notes / Chain`, `Assigned To`, `Follow-up Sent`, `Reply?` beyond the core fields), use the real columns described above.
- **Resolved**: `gws`'s Google auth token lived in the local encrypted keyring on Davide's desktop, not portable to a Routine's fresh cloud clone. Fixed by adding the service account described above, use that for any unattended run, not `gws`.
- The Routine's cloud environment needs `GOOGLE_SERVICE_ACCOUNT_JSON` configured as a secret (the full contents of `C:\Users\GIUSEPPE\.config\casdey\service-account.json`) before its first run, this has to be set once in the Routine's own settings, it doesn't come from `.env` automatically.

## Routine status
Live since 2026-08-12: a Claude Routine named "casdey cold outreach — daily" runs this skill unattended, daily at **10:00 CEST**, against `07davidelongo-eng/casdey` on `main`.

**Don't git commit or push from inside the Routine.** Two runs in a row hit this: the Routine's GitHub integration returns a hard 403 ("Resource not accessible by integration") on every write path, direct push, branch creation, and the GitHub MCP write tools alike, not a transient error, a real permissions gap in the installed GitHub App (it needs contents:write / ref-creation on this repo, worth fixing in GitHub's App settings if Davide wants the Routine to ever open PRs, but not required for outreach itself). Rather than depend on that: **this file is read-only from the Routine's perspective.** The authoritative per-run record is the `Send Log` tab, not this file, log everything there as already specified, and don't attempt to update "Batch history" below or anything else in this repo. Batch history here gets updated manually/periodically instead.

**2026-08-12, run 1: correctly stopped, nothing sent.** Routine was created before that day's skill edits (autonomous sending, reply detection, service account) were pushed, so it ran on the stale skill (review checkpoint still required, inbox reading still forbidden) against a prompt asking for the opposite, caught the contradiction, halted cleanly. Also couldn't find `.env`/`gws` (correct, neither exists in a Routine) and didn't yet know to read process env directly, fixed same day in "Which environment am I running in?" above.

**2026-08-13: cold email offer copy updated.** `casdey.com` went live in production this day. Per Davide's direction: the cold email now includes `https://casdey.com/waitlist`, and its offer changed from "free first week, no commitment" alone to that plus a Free plan after the trial and a lifetime £50/€59 discount if a lead later upgrades to Premium, framed explicitly as feedback-seeking rather than a sales pitch (see "The cold email" and "The full offer" above for the exact rules). If a Routine run reads a stale checkout that predates this commit, this note (and the two sections above it) is the source of truth, not whatever the Routine's own working copy still has cached.

**2026-08-13: follow-up sending turned on.** Per Davide's explicit go-ahead in chat that day, the one scheduled follow-up per non-replying lead is now sent automatically each run instead of only being listed as "due" (see "Follow-up policy" above). This was requested in the same conversation as the offer-copy update above but landed in a separate commit. Batch 3 (below) ran before both changes, on the old template with manual-only follow-ups.

## Batch history
| Date | Batch | Leads | Sent | Notes |
|------|-------|-------|------|-------|
| 2026-08-11 | 1 | 21 (existing sheet, `confirmed` email status only) | 21/21 | Manual batch, review checkpoint still active at this point. Follow-up due 2026-08-17 (next weekday after the 4-5 day window, since +4/+5 days landed on a weekend). 4 `VERIFY`-flagged leads held back, not yet verified. |
| 2026-08-13 | 2 | 32 (2 corrected batch-1 holdbacks + 30 newly sourced: Ireland, Netherlands, Germany, Portugal, Spain, new UK towns) | 32/32 | First real autonomous Routine run. VICI Dental's batch-1 email was wrong (`info@vicidental.com` doesn't exist), corrected to `enquiry@vicidental.com` after re-verifying against their site, same for Newcastle Advanced Dentistry. 3 leads held back as unverifiable: Central Park Dental and Andrew Brown Dental (batch-1 carryovers, still can't confirm), Galway Dentists (newly sourced, obfuscated email). Reply detection skipped this run, wrong mailbox mechanism used (fixed above). Hit a Zoho token rate-limit mid-batch from minting a fresh token per send, self-recovered, fixed above so it won't recur. Running total in `Send Log`: 53. |
| 2026-08-13 | 3 | 34 (16 UK: Hull, Preston, Wolverhampton, Stoke-on-Trent, Milton Keynes, Swindon, Portsmouth, Chester, Worcester, Aberdeen, Blackpool, Gloucester, Dundee; 18 EU: Dublin, Belfast, Amsterdam, The Hague, Berlin, Hamburg, Cologne, Frankfurt, Lyon, Brussels, Antwerp area, Porto, Valencia, Barcelona) | 34/34 | Ran on the old template, before the waitlist-link/beta-offer copy update and before follow-up sending was turned on (both above). Reply detection worked correctly for the first time: 0 genuine replies found against all 53 prior sends, 0 bounces from tracked sends. One send (Cottingham Dental Studio) went out as `mailFormat:html` instead of plaintext due to an initial format check, same visible content, no images/logos, rest sent plaintext correctly. Running total in `Send Log`: 87. |
