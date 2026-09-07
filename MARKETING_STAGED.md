# STAGED — "More, Better" outreach changes

**Status:** staged 2026-09-07. **Do NOT apply to the live routines until Davide confirms Resend Pro (or higher) is active.**
Trigger to apply: Davide says in the marketing chat that Resend is upgraded. **Resend Pro is live as of 2026-09-07, so the plan prerequisite is satisfied; this stays staged pending Davide own go-ahead and the two subject-line variants being finalised.** Until then both routines run unchanged (email 75/day reserved-floor split; IG 10 first-DM drafts/day).

Applied via `RemoteTrigger action:update` on the two triggers, then SKILL.md synced on branch `gym-outreach-automation`.

---

## CHANGE 1 — MORE volume, email routine (`trig_018wp58QLBbeuBPbMA6Fy1sU`)

**New rule (Davide 2026-09-07):** first-touch is the fixed growth lever at **100/day**; follow-ups are sized around it, no cap. Total may exceed 200/day and that is fine (~290/day expected steady state).

### Replaces the "VOLUME (Davide's standing rule, 75...)" paragraph:

> **VOLUME (Davide's call 2026-09-07, supersedes the 75/day reserved-floor split).**
> - **FIRST-TOUCH: exactly 100 per day**, every day incl. weekends. Fixed. Fewer only if the 'Ready for review' first-touch draft queue is genuinely exhausted — flag that loudly in STEP R.
> - **FOLLOW-UPS: every due follow-up (FU1 + FU2) goes out the day it is due. No cap.**
> - **No overall daily cap.** Total = 100 + due follow-ups.
> - **TRANSITION, first 7 days after this goes live ONLY:** cap follow-ups at **150/day**, oldest-due first, remainder rolls to the next run, so the accumulated backlog drains over a few days instead of one large spike. After the 7 days, remove the 150 cap. [On apply: write the concrete end-date in.]

### Replaces PART B (the reserved-floor split) with:

> **PART B — SENDING (automated, no approval gate).**
> (a) **FIRST-TOUCH — take exactly 100** drafts (Draft Status 'Ready for review', Status blank/'Not contacted'), ordered by LEVER 1 (clean Owner/Manager name AND/OR non-generic direct email first, then generic-inbox), oldest lead # first within each group. Alternate body variants A/B by lead-# parity. Assign SUBJECT variants per CHANGE 2.
> (b) **FOLLOW-UPS — send every due follow-up** (FU1 + FU2 together, oldest due-date first). Transition only: first 150, rest roll over.
> (c) No reserved floor, no auto-balance. First-touch is a fixed 100; follow-ups are whatever is due.
> Pre-send hard gates: **unchanged** (word count, em dash, price/currency, guarantee wording, lifetime discount, scarcity, waitlist link, old "what would you pay"/"which features" copy, empty subject/body, recipient already in Send Log, Status Dead / Reply Unsubscribed, byte-identical body in batch). A skipped first-touch draft → pull the next eligible so the count still hits 100.

### Sourcing (PART A) — raise the ceilings so 100/day first-touch never starves:
- "if 150+ leads already have Status blank/'Not contacted', skip sourcing" → **300+**
- "source up to 90 new leads" → **up to 200**

### STEP R additions:
- Total sent; first-touch count (flag if <100); follow-up count; follow-up carryover (transition only).
- Keep the existing all-time table and the A/B variant block; add the subject-variant block from CHANGE 2.

---

## CHANGE 2 — BETTER, week-1 test: first-touch subject-line A/B (email routine)

Goes live **at the same time as CHANGE 1** (weekly testing needs the 100/day volume to produce a weekly readout; at 25/day it is noise).

- New Send Log column **"Subject Variant"** = `S1` / `S2`, logged for every first-touch send.
- Assign subject variant **independently of the body A/B** — use lead-# mod 4: `0,1 → S1`, `2,3 → S2`. (Body A/B stays on lead-# parity, so the two factors are ~orthogonal and each can be read marginally.)
- **S1 vs S2 — the two subject approaches (FINALISE WITH DAVIDE BEFORE APPLY):**
  - `S1` — _[approach + example, e.g. curiosity/no-pitch: "quick one about your lapsed members"]_
  - `S2` — _[approach + example, e.g. plain benefit: "winning back members who cancelled"]_
- STEP R: add a block — S1 sent / replies / reply-rate, S2 sent / replies / reply-rate, one-line read ("too early" until each has a meaningful sample).
- Runs until the weekly meeting calls it (or 4 weeks unbeaten → established, move on).

---

## CHANGE 3 — MORE, IG routine (`trig_01La223qWjwxoumG4z8gssL8`)

Davide's target: 20 DMs/day = 10 first touches + 10 follow-ups.

- First-DM drafts: per-run cap **stays 10** (matches "10 first touches/day"). Raise the **buffer cap 40 → 60** so a steady 10/day hand-send rate never stalls sourcing.
- Follow-ups: **mechanics unchanged** — FU1/FU2 DM drafts, 4–5 day cadence, 2 max. This already mirrors the email follow-up pattern.
  - **ASSUMPTION (confirm with Davide):** "follow-ups as emails" in the Marketing Plan doc = _patterned on the email follow-up sequence_ (cadence, 2-max, copy rules), still delivered as Instagram DMs. NOT a literal channel switch to email. If Davide means literal email, CHANGE 3 needs a redesign (IG leads would need an email address + to enter the email FU pipeline).
- STEP R: add "follow-up drafts awaiting manual send (target ~10/day)".

---

## TEST LOG — new tab in `Casdey-Gym-Leads` (id `1WOAIA1gvK6S1kWe_Vf4-d4XmjhnDLQZLtyU_ezvOu3w`)

Created + header-maintained by the email routine (new **STEP -1**, idempotent, same pattern as the IG routine's column check). Weekly rows are pasted in by Davide from what Claude produces in the weekly meeting (routine does not write data rows).

**Columns:**
`A` Test ID · `B` Week started · `C` Week ended · `D` Asset (first-touch email / follow-up email / IG first DM / IG follow-up) · `E` Component (subject line / opener-hook / CTA-offer / offer framing / tone / structure / send time) · `F` Hypothesis · `G` Variant A · `H` Variant B · `I` Variant C · `J` Sends A · `K` Replies A · `L` Reply-rate A · `M` Sends B · `N` Replies B · `O` Reply-rate B · `P` Sends C · `Q` Replies C · `R` Reply-rate C · `S` Winner · `T` Decision / next step · `U` Weeks the current champion is unbeaten · `V` Status (running / decided / superseded) · `W` Notes

**Seed rows:**
- `T0` · ~2026-09-02 · _(blank)_ · first-touch email · CTA / offer framing · "a permission ask beats a free-to-try hook for a feedback-first cold email" · A = permission ("mind if I show you?") · B = free-to-try ("set it up free on your lapsed list, want in?") · … · Status: **running** · Notes: predates the formal loop, already tracked in Send Log "Variant"; still unvalidated (not enough data as of 2026-09-07)
- `T1` · _(apply date)_ · · first-touch email · subject line · _[hypothesis]_ · S1 = _[…]_ · S2 = _[…]_ · Status: **queued** (starts with the volume bump)

Marketing Plan Google Doc gets a one-line pointer to this tab.

---

## WEEKLY MEETING (manual, this marketing chat)

Every week (first one the Sunday after CHANGE 1+2 go live):
1. Claude reads `Casdey-Gym-Leads` (Send Log + Leads), computes per-variant sent / replies / reply-rate for every running test.
2. Pick winner(s). A variant needs a meaningful sample before it can win; "inconclusive → keep running" is a valid outcome.
3. Claude writes the completed Test Log row(s); Davide pastes into the tab.
4. Decide the next test to beat the current best. 4 consecutive weekly tests unbeaten → established winner, move testing to another asset/component.
5. Claude updates CLAUDE.md "Marketing plan" status + the memory if the direction shifts.
