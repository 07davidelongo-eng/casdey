---
name: gym-outreach
description: Runs casdey's gym/fitness-studio cold-outreach workflow — sourcing UK/EU gym and studio leads, drafting personalized cold emails and follow-ups, and sending via Resend once Davide/Abhi approve each batch. Use when asked to run outreach, draft a batch of cold emails, source new gym leads, or check outreach status/tracking. Supersedes the retired dental cold-outreach skill.
---

# casdey gym/fitness-studio outreach

Operating spec for casdey's cold-outreach system, targeting UK/EU gyms and fitness studios (the niche pivot from dental, see CLAUDE.md's "Niche pivot under consideration" and "Go-to-market plan for the niche pivot" sections, both required reading before running this). Invoked as `/gym-outreach`.

## Why this replaced the dental skill, and what's different
The dental cold-outreach skill (`.claude/skills/cold-outreach/`, now marked retired) ran fully unattended: an AI Routine sourced, drafted, and sent up to ~20 emails a day with no human review. 216 sends produced 0 genuine replies. The go-to-market plan drafted afterward (CLAUDE.md) concluded that volume without a human in the loop was itself part of the problem, not just the message, and calls for a manual/relationship-first approach for gyms: small batches, real review, direct conversations, feedback collected at every step. Davide confirmed this on 2026-08-22 with a **hybrid** model:
- **Automated**: lead sourcing and first-draft email copy.
- **Manual**: the actual send. Every batch is reviewed (and can be edited) by Davide/Abhi before anything goes out. No autonomous Routine sends email under this skill.

Email/community-DM outreach (Instagram, Facebook/Slack groups) that the go-to-market plan also calls for is Davide's own manual track, outside this skill's scope — this skill only covers the email channel, where casdey already has sending infrastructure.

## Which environment am I running in?
- **Local/interactive session on Davide's desktop**: `.env.local` (in `web/`) has `RESEND_API_KEY`, and `~/.config/casdey/service-account.json` has the Google service-account key. Use `GOOGLE_SERVICE_ACCOUNT_FILE` pointing at that path for Sheets access.
- **Unattended (the sourcing + drafting Routine, see "Routine status" below)**: credentials come from process env vars directly (`GOOGLE_SERVICE_ACCOUNT_JSON`, set as a secret in the routine's cloud-environment settings), same pattern the retired dental skill used. `RESEND_API_KEY` is deliberately NOT in this environment — the Routine only sources and drafts, it never sends, so it has no reason to hold a live sending credential at all.

## Resources
- **Lead list**: Google Sheet "Casdey-Gym-Leads" (id `1WOAIA1gvK6S1kWe_Vf4-d4XmjhnDLQZLtyU_ezvOu3w`), created 2026-08-22, shared Editor with `casdey-routine@casdey-gws-cli.iam.gserviceaccount.com`. Tabs:
  - `Leads` — columns: `#`, `Gym/Studio Name`, `City`, `Studio Type` (Independent/Chain/Franchise), `Phone`, `Address`, `Email`, `Owner/Manager`, `Email status` (`confirmed` vs `VERIFY`), `Notes / Chain`, `Instagram/Social`, `Other Channels Contacted`, `Channel Notes`, `Assigned To`, `Draft Subject`, `Draft Body`, `Draft Status` (blank / "Ready for review" / "Sent" — added 2026-08-22, see "Drafting" below), `Status` (Not contacted / Contacted / Replied / Interested / Committed / Dead), `Date Contacted`, `Follow-up Sent`, `Reply?`. The three social/channel columns (added 2026-08-22) are for Davide/Abhi's own manual outreach (Instagram DM, community/Facebook/Slack groups, per the go-to-market plan) — this skill only ever sources them for reference and never sends anything outside email itself.
  - `Send Log` — columns: `Lead #`, `Gym/Studio Name`, `Recipient Email`, `Date Sent`, `Salutation Type`, `Opening Line Used`, `Follow-up Due Date`, `Follow-up Sent (Y/N)`, `Notes`, `Resend Email ID`, `Opened?`, `Clicked?`, `Last Event At`. One row per send. Check this before ever drafting to a lead, to prevent duplicates.
  - `How to use` — brief pointer back to this file.
- **Sending**: Resend API (not Zoho — the dental skill's sender). **Root `casdey.com` is its own Resend-verified domain**, separate from `mail.casdey.com` (the product's campaign-email domain) — added 2026-08-22 specifically so outreach sends as `you@casdey.com`, a real person's address, not a subdomain. Safe alongside Zoho's existing mail on the same root: Resend's DKIM (`resend._domainkey.casdey.com`) and SPF (isolated on `send.casdey.com`, its own MX+TXT) are on dedicated subdomains, the root SPF/MX/DKIM Zoho uses for davide@/abhi@/info@ is untouched. Credentials: `RESEND_API_KEY` (already set, Sending-access-only scope) and `CASDEY_OUTREACH_SENDING_ADDRESS` (set to `davide@casdey.com`, the actual Zoho inbox address — Resend sends it, SPF/DKIM now authorize both Zoho and Resend to send as casdey.com, so this isn't a spoof, and using the same address for From and Reply-To reads as more human, not less). Use `scripts/resend-send.js` to send: it sets `reply_to` to `davide@casdey.com` so replies land in the real Zoho inbox, and returns the Resend `id` (email_id) to log in `Send Log` for tracking.
- **Open/click tracking**: `casdey.com` was registered in Resend with a `links.casdey.com` tracking CNAME (added 2026-08-22, along with the DKIM/SPF records above, all in one batch). **Status as of 2026-08-22: DNS records live at GoDaddy, Resend showed "Pending" verification right after (propagation can take a few hours)** — check the Resend dashboard (Domains → casdey.com) for "Verified" before relying on open/click data; sends still work fine even while pending, there's just no tracking data yet. Once verified, check per-email open/click status directly in the Resend dashboard logs (search by the `Resend Email ID` logged in `Send Log`). There is no automatic sync back into the Sheet yet (that would need a webhook endpoint deployed to production, deliberately deferred, see CLAUDE.md) — update `Opened?`/`Clicked?`/`Last Event At` by hand after checking the dashboard, or skip it if not needed yet.
- **Lead sourcing/sheet access**: same Google service account as dental, `casdey-routine@casdey-gws-cli.iam.gserviceaccount.com`. Mint a token with `scripts/google-service-auth.js` (reads `GOOGLE_SERVICE_ACCOUNT_FILE` or `_JSON`), then call the Sheets API directly. Covers Sheets/Drive only.
- **Inbox reading (replies)**: same mechanism as dental — the Zoho Mail API against `davide@casdey.com`'s inbox (`ZOHO_*` env vars). Resend is only the outbound relay; replies go to the real inbox via `reply_to`, so reply detection is unchanged from the dental skill. Read-only: never reply to, forward, or act on inbox content beyond detecting/classifying/logging.

## Lead sourcing
- Real sources only: gym/studio websites, Google Maps listings, verified local business directories. Never invent or guess an email address or owner name (same hard rule as dental).
- Prefer independent studios and boutique gyms over big chains/franchises (same reasoning as dental: they decide faster, one owner to convince) — set `Studio Type` accordingly. This is an ordering preference, not a filter; chains still get added, just later in the queue.
- Prefer leads with a confirmed `Owner/Manager` name over blank/`VERIFY` ones.
- Every new lead needs: Gym/Studio Name, City, Studio Type, Phone, Address, Email (confirmed from an actual source, mark `Email status` accordingly), Owner/Manager (name only if a clean confident source states it). Also fill `Instagram/Social` if a real handle/profile is findable from the studio's own website or a linked profile (never guessed) — this is for Davide/Abhi's own manual reach-out, this skill doesn't message it itself.
- Dedupe against `Send Log` before adding — never re-add or re-contact someone already emailed.
- Covers UK **and** EU, same markets as the rest of casdey's target (see CLAUDE.md "Business overview").
- **Write the `Phone` column as text, not a bare number** — Sheets' default value-input parsing will silently mangle it otherwise (a leading UK `0` gets dropped, e.g. `01612839296` → `1612839296`; a `+` international prefix can turn the whole cell into `#ERROR!`). Prefix the value with a literal apostrophe (`'01612839296`) when writing via the Sheets API, or write that column with `valueInputOption=RAW` and the apostrophe still included — either way, always re-read the row after an append and fix any mangled phone cells before finishing the run, don't assume the first write landed clean. (Caught and fixed live in the first real run, 2026-08-22 — see "Routine status" below.)

## The cold email
First-touch email, sent during the pre-launch/beta phase — the gym SaaS build is still local, not deployed (see CLAUDE.md), so this is the same "coming soon" framing the dental skill used, not "it's live now."

**Key points every cold email must hit** (any order/phrasing, no fixed template, vary structure and opening line per lead so it doesn't read as mail-merged):
1. Real pain point: cancelled or lapsed members who never come back = lost recurring revenue (MRR), a gap most gym software (Mindbody, Glofox, TeamUp, ABC Fitness) doesn't cover, it manages active members, not the ones who left.
2. What casdey does: reactivates those members on the studio's behalf automatically, no manual work, no ad spend, books them straight back into a class or session.
3. The offer: a free first week of Premium once the software ships, then a Free plan, then a lifetime £50/€59 discount if they choose to upgrade to Premium later, only available to people joining now. Never mention the standard ongoing price, the guarantee, scarcity, or bonus software — those stay held back for the manual follow-through once someone replies positively (see "The full offer" below).
4. Explicit feedback framing, stated plainly: this isn't a sales pitch, casdey genuinely wants their feedback on the product before it's finished.
5. The link: https://casdey.com/waitlist (already gym-facing copy, live in production).
6. Low-friction CTA: offer to work out, free, roughly how many cancelled/lapsed members they've likely got and what that's probably costing them in monthly recurring revenue, if they reply. Never assert a number, guess, or industry-average stat about their business specifically, that breaks "never invent a fact." Ask what makes the calculation possible (roughly how many active members they have, or a quick reply) rather than stating a figure. Example, vary per lead, never copy verbatim: "If it's useful, reply with roughly how many members you've got and I'll work out what a typical cancellation/win-back gap would be costing in MRR, no obligation."
7. A one-line opt-out ("let me know if you'd rather I not follow up again," varied per email) — PECR/GDPR risk reduction, covering EU.

Under ~150 words. Professional but a little more casual than the dental tone fit (fitness/gym owners skew younger and less formal than dental practice owners — still no superlatives, no hype, no stacked persuasion techniques). State the offer as one plain, clear idea. Use whatever specific detail is available (city, studio type, class-based vs open-gym) naturally.

**Tone guardrails, carried over from dental (still fully in force, same reasoning)**:
- Don't assert facts about the recipient's own business ("that's revenue you've already earned") — presumptuous, we don't know their numbers.
- Don't manufacture social proof ("a lot of London studios we've looked at...") — reads as a stock cold-email tactic.
- Don't stack multiple persuasion techniques in one email (pain point + value claim + urgency + CTA + opt-out) — pick fewer moves, sound observational, not pitched.
- Write like a specific person noticed something and is asking a genuine, slightly casual question, not a script executing a formula.

## Salutation rules (apply exactly, from the `Owner/Manager` column)
1. Blank/empty → "Hi there" or "Hi [Gym/Studio Name] team" (vary)
2. Contains "VERIFY", "verify", "no named owner found", "corporate", "group", or any hedge/uncertainty qualifier → "Hi [Gym/Studio Name] team" — never use a name from that cell even if one is present
3. Only use "Hi [FirstName]" when the field is a clean, confident single name with no qualifier — gym/fitness culture reads as more first-name-casual than dental, unlike the dental skill's "Dear Dr [Surname]" convention, don't carry that formality over
4. Always personalize [Gym/Studio Name] and [City]

## Style rules
- Never use em dashes (—) as punctuation. Use commas or separate sentences. Normal hyphens in compound words are fine.
- Sign-off: `Davide @casdey` — single line, no line break, no "Best,"/"Regards," preamble.
- Plain text only, no logos, no image attachments.

## The full offer (reference only — NEVER put this in a cold email or follow-up)
Everything below is held back for Davide/Abhi to walk a lead through manually once they reply positively:
- Standard ongoing price, after the beta discount period: £250/mo GBP or €290/mo EUR. Annual: £225/mo GBP or €262/mo EUR.
- Guarantee ("Profit or nothing"): if casdey doesn't generate more revenue than the studio invested, 100% refund + free software until that condition is met.
- Bonus/scarcity elements: only use if and when Davide explicitly revives them for this niche, not carried over from dental by default.
- **Fulfillment note**: the SaaS isn't deployed yet (built locally, see CLAUDE.md "Niche pivot" for status). If a studio says yes to the free week before it's live, Davide/Abhi handle that manually, honouring what's already stated in the cold email.

## Drafting
Writing the actual email text is automated (runs both live and in the sourcing+drafting Routine, see "Routine status"). What is NOT automated is sending it — that boundary is what "Review-gated sending" below is about, don't conflate the two. Each time this runs:
1. Read `Leads` for rows with `Status` blank/"Not contacted" and `Draft Status` blank (no draft yet, or a stale one worth refreshing).
2. For each, write `Draft Subject` and `Draft Body` following every rule above ("The cold email", "Salutation rules", "Style rules") — real pain point, the beta offer, feedback framing, the waitlist link, the free-calculation CTA, the opt-out line, correct salutation from `Owner/Manager`, no em dashes, under ~150 words, varied phrasing so it doesn't read as mail-merged across the batch.
3. Set `Draft Status` → "Ready for review".
4. Also draft follow-ups: for leads whose `Follow-up Due Date` has passed with no reply and no opt-out (per `Send Log`/`Reply?`), write a follow-up into the same `Draft Subject`/`Draft Body` columns (same content rules as the cold email, referencing the first email since Resend/email doesn't thread like a real reply), `Draft Status` → "Ready for review".
5. Never touch `Send Log`. Never call `scripts/resend-send.js`. Drafting is not sending, full stop.

## Review-gated sending (not autonomous)
This is the core difference from the retired dental skill, and the one rule that doesn't change no matter how much of the rest gets automated: **a human has to look at a draft before it goes out.** Drafts usually already exist by the time this runs, written by the sourcing+drafting Routine or an earlier live session (see "Drafting" above) — this step is about reviewing and sending them, not usually writing them from scratch. Each time this is invoked live with Davide/Abhi:
1. Read `Leads` for rows with `Draft Status` = "Ready for review". If none exist yet (e.g. the Routine hasn't run, or every existing lead already has a verdict), fall back to drafting a small batch live first (see "Drafting"), target **~5 leads** (matching the go-to-market plan's Week 1 pace, see CLAUDE.md).
2. **Show every ready draft to Davide/Abhi before sending anything.** Present each as (recipient, subject, body) for review; incorporate any edits they give, writing edits back into `Draft Subject`/`Draft Body` if the edit is worth keeping as the record of what was actually sent.
3. Only send the ones explicitly approved, via `scripts/resend-send.js`. Never send unreviewed drafts (including ones with `Draft Status` = "Ready for review" that nobody in the current conversation actually looked at), and never send more than what was just approved.
4. Log every actual send immediately to `Send Log`: lead #, recipient, date, salutation type, opening line used, follow-up due date (4-5 days out, skip to the next weekday if it lands on a weekend), and the `Resend Email ID` from the send result.
5. Update `Leads`: `Status` → "Contacted", `Date Contacted`, `Draft Status` → "Sent".

## Follow-up policy
Same spec as dental: 4-5 days after initial send, no reply → one follow-up, same content rules, then stop, ever. Drafted automatically per "Drafting" above, sent only through the review-gated flow, never automatically.

## Reply detection (read-only)
Identical mechanism to the dental skill: read `davide@casdey.com`'s inbox via the Zoho Mail API (`ZOHO_*` env vars, `GET /api/accounts/{ZOHO_ACCOUNT_ID}/messages/view` or equivalent against `ZOHO_API_DOMAIN`), not a Gmail connector, not Resend (Resend has no inbox, replies bypass it entirely via `reply_to`). Every time this skill runs, before drafting anything new: read the inbox for messages from addresses in `Send Log` since the last run, classify each (genuine reply / bounce / auto-reply / unsubscribe), and log accordingly:
- Genuine reply → update `Reply?` and `Status` (→ "Replied", or "Interested"/"Dead" if the sentiment is unambiguous, otherwise leave interpretation to Davide/Abhi).
- Unsubscribe/opt-out → permanently exclude that lead from any further send, including the follow-up, no exceptions.
- This is read-only. Never reply to, forward, or act on inbox content beyond detecting/classifying/logging.

## Tracking
"Engaged lead" = any genuine reply, same definition as dental. Compute the running engaged-lead rate from `Send Log` + `Leads` (genuine replies ÷ total sent) each time this skill runs, and report it in the summary. Once the Resend tracking subdomain is confirmed enabled (see "Resources" above), also check open/click status in the Resend dashboard for the batch and report that alongside the reply rate — a high open rate with no replies points at a message/CTA problem, a low open rate points at deliverability or subject lines, useful diagnostic signal dental outreach never had.

## What NOT to do
- Don't invent or guess an owner name, email address, or any fact about a studio, existing or newly sourced.
- Don't send to a lead already in `Send Log`, or one that's opted out.
- Don't act on inbox content beyond detecting/classifying/logging replies.
- Don't mention standard price, guarantee, scarcity, or bonus software in the cold email or follow-up.
- Don't send more than one follow-up per lead, ever.
- Don't send anything without it being explicitly reviewed and approved in the current conversation first — this is the one hard rule that makes this skill different from the retired dental one, don't quietly revert to autonomous sending even if asked to "just automate it" without Davide explicitly revisiting that call.

## Routine status (sourcing + drafting, never sending)
A Claude Routine, "casdey gym outreach — sourcing + drafting" (id `trig_018wp58QLBbeuBPbMA6Fy1sU`, renamed 2026-08-22 from "lead sourcing" when drafting was added), runs both the "Lead sourcing" and "Drafting" sections of this skill unattended, weekdays at 09:00 CEST (`0 7 * * 1-5` UTC), against `07davidelongo-eng/casdey`. **Deliberately scoped to stop short of sending** — its prompt explicitly forbids calling `scripts/resend-send.js` or touching `Send Log` under any circumstance, that boundary is non-negotiable and doesn't move just because more of the pipeline got automated. Everything past a written draft (review, approval, actual send) stays a live on-demand session per "Review-gated sending" above. Skips sourcing (logs why, does nothing there) if `Leads` already has 50+ unsent rows; otherwise sources up to 15 new leads per run, then drafts for every undrafted lead and every due follow-up, so by the time Davide/Abhi open a review session there's usually already a batch of "Ready for review" drafts sitting in the sheet, not a blank slate. `RESEND_API_KEY` is deliberately not present in this routine's cloud environment, on top of the prompt-level prohibition, so it can't send even if instructed to. MCP connectors that got auto-attached at creation (Gmail, Google Drive, Calendar, Notion) were stripped immediately, none of them are needed for this task and an unattended routine pulling from live web pages during sourcing is a real prompt-injection surface, no reason to hand it credentials it doesn't use.

**Branch note (important):** this skill's own files live on a dedicated branch, `gym-outreach-automation`, not `main`. `main` still carries the unpushed gym SaaS rebuild (commit `25af6aa`) that Davide deliberately kept local, not deployed — pushing this skill to `main` would drag that rebuild into production too, which wasn't the ask. So `gym-outreach-automation` was branched off the local `main` (meaning it *does* contain the SaaS rebuild in its own history, just not on `main` itself, and pushing a non-`main` branch doesn't trigger a Vercel deploy either way) and only today's outreach-specific commit was pushed. The routine's `job_config.ccr.session_context.sources[0].git_repository` is pinned to `revision: "gym-outreach-automation"`, and its own instructions also unconditionally `git checkout gym-outreach-automation` as a first step (belt and suspenders, in case the default clone ever ignores the revision pin). **If this skill is ever merged/rebased onto `main` for real** (i.e., once the gym SaaS rebuild itself gets pushed), update the routine to drop the revision pin and the explicit checkout step, both become unnecessary at that point.

Needs `GOOGLE_SERVICE_ACCOUNT_JSON` set as a secret in the routine's own cloud-environment settings (`casdey-Outreach`) — set 2026-08-22, confirmed via a real test run.

**First real run, 2026-08-22 (manually triggered test, not the scheduled fire): success.** `Leads` was empty, so it sourced rather than skipped: 14 real, independent gyms/studios across UK + EU (Manchester, Bristol, Edinburgh x2, Cardiff, Leeds, Brighton, Dublin, Amsterdam x2, Barcelona x2, Lisbon, Berlin), every email confirmed on-site, no invented facts, only one owner name used (a source that actually named one). Scope held: `Send Log` untouched, nothing drafted or sent, nothing committed/pushed. Caught and self-corrected the phone-formatting bug now documented above before finishing. Two earlier attempts before this one failed for infrastructure reasons, not sourcing-logic reasons, both fixed same day: the first ran before this skill existed on any pushed branch at all (see "Branch note" above); the routine's cloud environment also came pre-loaded with old dental-era `ZOHO_*` env vars sitting in plaintext (same box used for `GOOGLE_SERVICE_ACCOUNT_JSON`, "Environment variables" in the environment's settings, not a real secrets vault, that's just how this UI works, worth knowing before adding anything sensitive there).

## Status
Built 2026-08-22. Sourcing confirmed working via a real test run (14 leads). Drafting added to the Routine the same day, not yet confirmed via a real run — next scheduled fire is 2026-08-24 09:00 CEST, or trigger manually to test sooner. `CASDEY_OUTREACH_SENDING_ADDRESS` set in `.env.local`, Resend tracking subdomain verified. Nothing sent yet under this skill — that's still Davide/Abhi's own call, whenever a batch of "Ready for review" drafts is worth looking at.
