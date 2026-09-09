---
name: hormozi
description: >-
  Alex Hormozi's business frameworks ($100M Offers, $100M Leads, $100M Money
  Models), distilled and mapped to casdey. Invoke this whenever the work is a
  business decision rather than a coding one: designing or pricing an offer,
  writing or reworking cold/warm outreach, lead generation and channel choice,
  the free/paid tier split, the guarantee, trial mechanics, monetisation and
  upsells, retention, referrals, scaling spend, or judging "is this worth
  doing". Also invoke it when Davide asks "what would Hormozi do", mentions a
  Hormozi idea by name (value equation, Grand Slam Offer, Core Four, CFA,
  LTGP:CAC, More Better New, Rule of 100), or is weighing a marketing/growth
  move and hasn't said which framework. Davide treats Hormozi as his primary
  business mentor, so this lens is the default for casdey strategy work, not an
  optional extra. It does not need to be invoked for pure copywriting polish or
  for engineering tasks with no business call attached.
---

# Hormozi consulting for casdey

Davide has one business mentor by deliberate choice: Alex Hormozi. He has read
*$100M Offers* and *$100M Leads*; *$100M Money Models* is next. The point of
this skill is to let casdey be run against Hormozi's frameworks as the working
lens, applied to casdey's real situation and numbers, and adapted where casdey
genuinely differs, rather than recited.

This is advisory. It gives Davide a Hormozi-grounded recommendation and names
the framework it comes from, so he can act on it or overrule it. It is not a
rule engine and it is not a Hormozi impersonation.

## When you're using this

You're here because the task in front of you is a business decision. Typical
shapes:

| The decision | Start with |
| --- | --- |
| Offer design, value, price, guarantee, trial, bonuses, naming | `references/offers.md` |
| Getting leads: channel choice, cold/warm outreach, content, paid ads, lead magnets, referrals, scaling volume | `references/leads.md` |
| Monetisation: tier split, upsells, downsells, what to charge when, 30-day cash, payback period | `references/money-models.md` |
| "Is this worth doing / are we focused on the right thing" | whichever of the three the bottleneck sits in (see "Find the constraint" below) |

Read the one or two reference files that match. Each is a distilled map of the
framework plus a casdey-specific section. They are notes, not the books.

## The procedure

1. **Name the decision in one sentence.** What is actually being decided, and
   what would change depending on the answer. If it's vague, tighten it first.

2. **Find the constraint.** Hormozi's own sequencing is: a business needs
   enough leads, a good enough offer, and a way to monetise that outpaces the
   cost of getting customers. Whichever of those is most broken is where the
   next move should be. Don't optimise the offer if the problem is that nobody
   is seeing it, and don't pour volume into outreach if the replies aren't
   converting. Say which constraint you think casdey is against right now and
   why.

3. **Pull the framework.** From the matching reference file, state the relevant
   Hormozi framework plainly and briefly, in its own terms.

4. **Apply it to casdey with real inputs.** Use casdey's actual numbers and
   state, not hypotheticals. Sources on hand:
   - `CLAUDE.md` — pricing, costs, unit economics, outreach status, decisions
   - `web/SAAS_V1_PLAN.md` §F0 — the tier/price/cost basis
   - `casdey-hq.md` — the one-page business summary (offer, prices, per-gym
     economics, break-even, status)
   - the "Marketing plan (Hormozi)" section of `CLAUDE.md` — current outreach
     volume and the weekly test loop
   - the live leads sheet (`Casdey-Gym-Leads`) for outreach performance
   - `.claude/skills/gym-outreach/SKILL.md` (on branch `gym-outreach-automation`)
     for how outreach actually runs
   If a number you need isn't written down, say so rather than inventing it.

5. **Check the ledger.** Read `references/casdey-ledger.md`. It records how
   casdey already maps to each framework and, importantly, every place casdey
   has deliberately diverged and why (cold outreach instead of warm, for one).
   Don't re-litigate a settled divergence. Do flag it if the new decision
   depends on one.

6. **Recommend, and mark the divergences.** Give the call you'd make. Where it
   follows Hormozi, say which piece. Where casdey should deviate, say so
   outright and give the reason casdey's situation justifies it. "Hormozi says
   X; for casdey I'd do Y because Z" is a perfectly good answer and often the
   right one. Deviation is allowed; unconsidered deviation is not.

7. **Offer to log it.** If the decision is a real one that future sessions
   should not reopen, offer to append it to `references/casdey-ledger.md` —
   one entry: the decision, the framework it relates to, whether it followed
   or diverged, and the reason.

## Adapting, not obeying

Hormozi is guidelines, not scripture. The clearest example is already live:
he teaches starting with warm outreach to people who know you, and casdey
went straight to cold, because Davide has no warm list in the gym world and
cold fit casdey's and his own situation better. That was the right call. The
frameworks are a way to reason, a checklist of what matters and in what order.
When casdey's facts genuinely differ from the book's assumptions, follow the
facts and record why.

Watch for the opposite failure too: "we're different" used to dodge a
framework that actually applies. If the only reason to deviate is that the
Hormozi move is harder or less comfortable, that's not a reason.

## Going deeper than these notes

The reference files are summaries. When a decision needs more than a summary:

- **The books.** In `Alex Hormozi/` at the repo root: the PDFs
  (`100M-Offers.pdf`, `100M-Leads.pdf`, `100M-Money-Models.pdf`, plus two
  `...-Outreach-pack.pdf` companion files) and, alongside them, OCR'd
  `100M-*.txt` versions with page markers (`===== [100M-Offers pg-042] =====`)
  — the PDFs are image-only scans, the `.txt` files are the searchable copy.
  All gitignored (copyright). Grep the `.txt` for a term, then read that page
  span to confirm an exact framework detail or lift a worked example. The
  `references/` notes were distilled from a full read of these; go to source
  only when a decision turns on a detail the notes don't carry.
- **His videos.** Hormozi's YouTube (@AlexHormozi) and podcast restate the
  books and sometimes go more current and more tactical. Use WebSearch/WebFetch
  when the books are thin on a specific tactic, when casdey's question is about
  execution detail the books gloss, or when something may have moved since 2023.
  Prefer the books for framework definitions; use video for depth and for
  anything post-book. Cite what you pulled from.

## Keeping the notes honest

If you find a place where these reference files are wrong, stale, or thinner
than the decision needs, fix the file as part of the work and say you did.
This skill is only as good as the distillation in `references/`.
