# casdey — V1 onboarding plan (self-serve)

> Part 2's readiness gates are folded into the sequenced build plan in
> `SAAS_V1_PLAN.md` (Track A + Track C). This file stays as the detail on the
> self-serve flow itself and the post-signup playbook.

Drafted 2026-09-02. This is a **plan on the shelf**, to execute when V1 is ready
and it's time to onboard the engaged leads coming out of outreach. Not built yet.

## The decision that shapes everything
**Self-serve is the goal** (Davide, 2026-09-02): the product should walk a gym
owner from signup to first win-back with **zero human help**. Davide only steps
in (**hybrid** fallback) if a gym gets stuck or activation/conversion is weak.
"That's why I want V1 functioning well" — a self-serve onboarding is only as good
as the product's ability to carry a non-technical owner through setup unattended.

This ties directly to the outreach promise: the gym cold email now says casdey
"reaches out in your gym's name and books them straight back in", and variant B
offers to "set it up free on your lapsed list". Onboarding has to actually
deliver that, unattended.

## Part 1 — The self-serve flow the gym goes through
For each step, what the gym does, and what the **product must deliver** or
self-serve breaks:

| Step | Gym does | Product must deliver |
|---|---|---|
| 1. Sign up | Clicks link, creates account, free week starts | Frictionless signup, no card, clear "your 7 days start now" |
| 2a. Import members | Uploads CSV export from their gym software | **The #1 failure point.** Dead-clear per-platform export instructions (Mindbody / Glofox / TeamUp / ABC), forgiving parser, human error messages, email/phone normalization |
| 2b. Confirm lapsed | Sees "here are your X lapsed members" | Sensible default lapse window, editable, a preview that feels right |
| 2c. Set prices | Enters membership tiers | Simple entry (drives revenue-recovered + the guarantee) |
| 2d. Connect calendar | Connects Google Calendar | Calendar OAuth **live in prod** since 2026-09-03 (B1 + B2 done) |
| 2e. Approve campaign | Reviews casdey's draft, approves | Great default copy in gym voice, obvious approve button, mandatory-approval gate |
| 3. See value | Watches replies + rebookings land | Dashboard that makes "£X recovered" obvious, fast |
| 4. Stuck? | Opens the in-app help widget | FAQ that answers every setup step; mailto info@casdey.com fallback |
| 5. Convert | Picks Standard or Pro after the free week | In-app tier chooser (Standard €99 / Pro €289), lifetime 20% early-adopter discount auto-applied, the guarantee shown on Pro, referral prompt |

## Part 2 — Readiness checklist (gates before inviting a real gym)
Self-serve is unforgiving, so these must be solid first:

1. **A guided first-run wizard exists** — steps 2a→2e as one walked path, not
   scattered settings pages. **Likely the biggest build gap; verify this first.**
   Self-serve lives or dies on it.
2. **CSV import tested against real** Mindbody / Glofox / TeamUp / ABC exports
   (formats differ; the import path is generic CSV, the direct integration is a
   Mindbody stub).
3. **Google Calendar booking live in prod** + OAuth consent screen published —
   **done 2026-09-03** (B1 + B2). Still needs one real end-to-end prod check
   (Track C, C3).
4. **Default campaign copy** good enough in gym voice to approve unedited —
   met.
5. **Free-week → Standard/Pro → 20% lifetime discount → guarantee (Pro)** all
   working end-to-end in prod (code done; the live Stripe prices/coupon +
   env vars are Davide's, F2; confirm in prod, C1).
6. **Support FAQ** covers every wizard step; **empty/edge states** handled
   (no members imported, no calendar connected, zero lapsed members).

## Part 3 — The playbook once a gym says yes (mostly product-driven)
0. **The reply (manual, Davide).** Thank + confirm the free setup; ask the
   held-back questions (which gym software, ~how many members, and the
   "what would you pay / what's missing" data question); send the signup link.
1. **They self-serve** through Part 1's wizard. Davide monitors.
2. **Feedback loop.** Check in day 2-3 and end of the free week: what was
   confusing, what's missing, what would make it a must-have. Implement fast
   (treat them as a design partner — Hormozi framing from the GTM plan).
3. **Convert.** After the week, the in-app upgrade presents price + lifetime
   discount + profit-or-nothing guarantee. Pitch the referral campaign.
4. **Testimonial.** Once they've recovered real revenue, ask for a short
   testimonial/review and activate their referral link. Feeds V2 copy + growth.

**Fallback (hybrid):** if activation or conversion is weak, flip to a guided
kickoff call where Davide sets it up with them. The Part 2 gates are what keep
you out of needing this.

## Where the engaged leads come from
Both outreach channels feed this (see the routines + `CLAUDE.md`):
- **Email** (automated, 75/day): a positive reply lands in davide@casdey.com.
- **Instagram** (semi-auto, manual send): a reply lands in casdey's IG DMs.
Track each engaged lead through the playbook stages (a simple pipeline: the
lead sheet's status columns, or a dedicated tab, when volume warrants it).
