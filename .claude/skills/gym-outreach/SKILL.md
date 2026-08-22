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
- **Unattended (if this is ever converted to a Routine later, not currently the case)**: credentials would come from process env vars directly (`RESEND_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`), same pattern as the retired dental skill used. Not set up as of 2026-08-22 — sending stays manual, see above.

## Resources
- **Lead list**: Google Sheet "Casdey-Gym-Leads" (id `1WOAIA1gvK6S1kWe_Vf4-d4XmjhnDLQZLtyU_ezvOu3w`), created 2026-08-22, shared Editor with `casdey-routine@casdey-gws-cli.iam.gserviceaccount.com`. Tabs:
  - `Leads` — columns: `#`, `Gym/Studio Name`, `City`, `Studio Type` (Independent/Chain/Franchise), `Phone`, `Address`, `Email`, `Owner/Manager`, `Email status` (`confirmed` vs `VERIFY`), `Notes / Chain`, `Instagram/Social`, `Other Channels Contacted`, `Channel Notes`, `Assigned To`, `Status` (Not contacted / Contacted / Replied / Interested / Committed / Dead), `Date Contacted`, `Follow-up Sent`, `Reply?`. The three social/channel columns (added 2026-08-22) are for Davide/Abhi's own manual outreach (Instagram DM, community/Facebook/Slack groups, per the go-to-market plan) — this skill only ever sources them for reference and never sends anything outside email itself.
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

## Review-gated sending (not autonomous)
This is the core difference from the retired dental skill. Each time this skill is invoked:
1. Check `Leads` for remaining unsent leads. If fewer than ~20 remain, source more first (see "Lead sourcing").
2. Draft a small batch, target **~5 leads** (matching the go-to-market plan's Week 1 pace of 5/day, see CLAUDE.md), following all content/tone/salutation rules above.
3. **Show every draft to Davide/Abhi before sending anything.** Present each as (recipient, subject, body) for review; incorporate any edits they give.
4. Only send the ones explicitly approved, via `scripts/resend-send.js`. Never send unreviewed drafts, and never send more than what was just approved in this conversation.
5. Log every actual send immediately to `Send Log`: lead #, recipient, date, salutation type, opening line used, follow-up due date (4-5 days out, skip to the next weekday if it lands on a weekend), and the `Resend Email ID` from the send result.
6. Update `Status` → "Contacted" and `Date Contacted` in `Leads`.

## Follow-up policy
Same spec as dental: 4-5 days after initial send, no reply → one follow-up on the same thread-equivalent (a fresh email referencing the first, since Resend/email doesn't thread the way a reply would), same content rules, then stop, ever. Follow-ups go through the same review-gated flow above, they are not sent automatically. When this skill is invoked, check for leads whose `Follow-up Due Date` has passed with no reply and no opt-out, and include them in the batch presented for review alongside any fresh cold-email drafts.

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

## Routine status (sourcing only)
A Claude Routine, "casdey gym outreach — lead sourcing" (id `trig_018wp58QLBbeuBPbMA6Fy1sU`), runs the "Lead sourcing" section of this skill unattended, weekdays at 09:00 CEST (`0 7 * * 1-5` UTC), against `07davidelongo-eng/casdey` on `main`. **Deliberately scoped to sourcing only** — its prompt explicitly forbids drafting or sending, and it never touches `Send Log`. This is the one piece of this skill that runs unattended; everything past sourcing (drafting, review, sending) stays a live on-demand session per "Review-gated sending" above, that boundary doesn't change just because sourcing is now automated. Skips its own run (logs why, does nothing) if `Leads` already has 50+ unsent (blank/"Not contacted") rows, otherwise sources up to 15 new leads per run. MCP connectors that got auto-attached at creation (Gmail, Google Drive, Calendar, Notion) were stripped immediately, none of them are needed for this task and an unattended routine pulling from live web pages during sourcing is a real prompt-injection surface, no reason to hand it credentials it doesn't use. Needs `GOOGLE_SERVICE_ACCOUNT_JSON` set as a secret in the routine's own settings (full contents of the service-account key file) before its first real run — not yet confirmed set as of 2026-08-22.

## Status
Built 2026-08-22, not yet run for real (sourcing Routine created same day, first fire 2026-08-24). Before the first real batch: set `CASDEY_OUTREACH_SENDING_ADDRESS` in `.env.local`, confirm the Resend tracking subdomain is enabled (added 2026-08-22, verification pending DNS propagation), and set `GOOGLE_SERVICE_ACCOUNT_JSON` in the sourcing Routine's settings (see above).
