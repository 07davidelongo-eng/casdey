# casdey V1.1 plan

V1 was declared complete on 2026-09-07 and casdey.com is published. V1.1 is a
different kind of release: V1 was about whether the product works, V1.1 is about
whether anyone activates. It comes out of the Hormozi diagnosis run on
2026-09-10 (`.claude/skills/hormozi/references/casdey-ledger.md`), which found
the binding constraint is not the offer and not monetisation, it is leads, and
specifically the collapse between a reply and an activated account.

Read `SAAS_V1_PLAN.md` for the V1 board and the tier/price basis (§F0). Read the
ledger before changing anything here, because most of these decisions are
Hormozi calls with a recorded reason.

---

## Why V1.1 exists, in numbers

Pulled from the live `Casdey-Gym-Leads` sheet and the production database on
2026-09-10.

| Funnel step | Count |
| --- | --- |
| Gyms first-touched | ~730 |
| Responses | 13 (~1.9%) |
| Replies still alive | 3 (8 of 11 went Dead, 2 unclassified) |
| Marked Interested | 1 |
| Signed up | 1 (BodyActive Skibbereen, 2026-09-08) |
| Imported a member | **0** |
| Paying | **0** |

The one real signup created an account, signed in once, and did nothing:
no members, no prices, no offer, no campaign, no processing agreement. The free
week was due to expire on 2026-09-15 having shown them nothing. That is the
whole problem V1.1 addresses.

Hormozi's read on this shape is unambiguous ($100M Money Models, Trial With
Penalty, pg 121-130): a free trial with no card and no required actions is the
version people do not use, do not get value from, and do not convert from. He
calls the customers he lost to it "thousands".

---

## Track H, Trial With Penalty

**BUILT 2026-09-12, commit `534f8b0`, behind `CASDEY_TRIAL_PENALTY` (default
OFF). Not pushed. Migration `0038` applied to the live DB.** Everything below
describes what was built; the differences from this spec and what is still
owed are in "Track H, what is still owed" at the end of this section.

The main build. Replaces the current "7 free days, no card, then drop to Free"
with Hormozi's Trial With Penalty, adapted for self-serve signup.

**Decided 2026-09-10 by Davide.** This reverses the settled "no card taken"
billing decision from 2026-08-14. Logged in the ledger.

### The shape

| Moment | What happens |
| --- | --- |
| Signup | **€1 charged now**, card saved. Still presented as a free trial. |
| Signup | Affirmative commitment step: "if casdey brings members back, will you stay on?" |
| Signup | Terms checkbox: the week is free as long as setup is finished, otherwise €20 per unfinished step, €60 max |
| During the week | Full Pro features, same as today |
| Cancelled at any point in the week | At day 7 they drop to **Free**. No Pro charge, **and no setup fee**, even if steps were unfinished |
| Day 7, all 3 steps done, not cancelled | Auto-converts to **Pro €289/mo** with the 20% early-adopter coupon applied (€231.20) |
| Day 7, steps unfinished, not cancelled | **€20 charged per unfinished step** (max €60) to the saved card, then drops to Free |

### The three activation steps

Chosen because they are the actions that both activate the gym and produce the
evidence the profit-or-nothing guarantee is later judged on:

1. Import the member list
2. Set service prices
3. Approve the first campaign

### Why a fee at all, and why it is not revenue

Hormozi is explicit (MM pg 130): "You make money by getting people results and
turning them into customers, not nickeling and diming people with fees." The fee
exists to move one number, the share of trials that get set up. If every gym
activates and no fee is ever charged, the mechanism worked perfectly. It is a
threat that should mostly never fire.

Sizing: the thing being paid for is the week of Pro they sat on. Pro is €289/mo,
so roughly €72 for a week. €20 per step across 3 steps, capped at €60, sits just
under that and is a cleaner number. Per-step rather than one lump sum follows MM
pg 124, "I'd rather bill $50 for each mess up than one $500 fee on their first
mess up", which applies here because the three steps are sequential and none is
individually catastrophic to miss.

### The escape hatches are part of the design, not softness

MM pg 128: "Reach out to people multiple times before you get to this point.
Offer to waive the fee if they do. I don't like billing non-starters. A small fee
isn't worth a 1-star review."

- **Nudge emails on trial days 2, 5 and 6**, each naming only the steps still
  outstanding and offering a call.
- **Waiver**: any fee can be waived from `/admin`, which refunds it.
- **Make up for goofs** (MM pg 128): completing a step within 7 days of being
  billed for it automatically refunds that step's €20.
- **A gym that cancels owes nothing.** The fee targets the ghost who took a free
  week and sat on it, not the decliner who actively opted out. This leaves a
  small loophole (use Pro for six days, cancel, pay €1) and that is accepted: the
  card plus commitment ask at signup filters most of it, and the fee is not
  revenue anyway.

### The honest adaptation

Hormozi sells this on a call. A human takes the card, the fee clauses get
initialled separately, and the fee is explained *after* the card is down (MM
pg 126) because explaining first raises resistance. casdey's signup is
self-serve, so that texture is gone. The self-serve version compensates with
plain terms at signup, the nudge emails, and the waive-on-a-call hatch. It is
weaker than the in-person version and still far stronger than what exists today.

Per MM pg 129, **call it a "free trial" everywhere in the UI**. Never "trial with
penalty", never "penalty" in gym-facing copy. "Setup fee" is the customer-facing
word.

### Build notes

**Stripe.** One €1 PaymentIntent at signup with `setup_future_usage:
'off_session'` charges and saves the card in a single step, simpler than a
SetupIntent plus a separate charge. Day-7 conversion is
`stripe.subscriptions.create()` against the Pro price with the
`STRIPE_COUPON_PERCENT` coupon and the saved payment method. The existing webhook
then writes `plan_tier` as it does today.

**Schema.** New columns on `gyms`: `trial_card_setup_at`, `trial_cancelled_at`,
`trial_converted_at`, `trial_commitment_at`, and three activation timestamps
(`activated_import_at`, `activated_prices_at`, `activated_campaign_at`). New
table `trial_penalties` (gym_id, step, amount_minor, stripe_payment_intent_id,
charged_at, refunded_at, refund_reason).

**Grant the new table.** `0029` and `0031` created tables with RLS on and no
grants, which made two shipped features look unbuilt until `0032` fixed it. Check
grants on `trial_penalties` before calling this done.

**Day-7 job.** Extends the existing daily cron. Note Vercel is on Hobby, so cron
is once daily at 03:00 UTC, which means "day 7" resolves within a day, not to the
hour. Acceptable. Revisit if Vercel goes Pro.

**Guarantee interaction.** `premium_started_at` arms on the first campaign after
the day-7 conversion. No change to that logic, the trial now just feeds it
cleanly.

**Events.** `trial_started`, `trial_step_completed` (with step name),
`trial_converted`, `trial_cancelled`, `trial_penalty_charged` to PostHog, so the
activation funnel is finally measurable. Today it is invisible.

**UI.** A trial state panel showing days left, steps outstanding, what happens at
day 7, and the cancel control. The onboarding checklist is the visible half of
this track.

---

## Track H, REDESIGNED 2026-09-12: the setup fee is gone

**Read this before the rest of Track H, which still describes the fee.** Davide
dropped the setup fee on 2026-09-12. What ships is a **paid first week**: 1 euro
and a card at signup, the commitment ask, the activation checklist and the
nudges, and at day 7 the Pro subscription begins unless the gym cancelled. There
is no fee for unfinished steps, no cap, no make-good refund and no admin waiver.
The full reasoning is in the ledger; the short version is that the mechanism
comes from gym businesses where an unused trial costs a coach's hour, a dormant
SaaS trial costs nothing, and Ireland (where casdey's only customer is) never
adopted Makdessi and still treats a deterrent clause as an unenforceable penalty
under Dunlop.

What this keeps is the property the diagnosis actually cared about: **day 7
forces a decision.** The old free week expired quietly, the gym drifted to Free,
and nothing happened, which is exactly what BodyActive did.

**The marketing copy now follows the flag. Done 2026-09-12.** Every public
price claim branches on `paidTrialEnabled()`: the hero pill and CTA, the header
button, the closing band, the offer panel (both cards, the heading and the
lede), the pricing page hero and its first FAQ answer, the pricing table's
buttons, the footer link, and both states of the login form. The repeated
strings live in `src/lib/offer-copy.ts`; the prose branches in place, next to
the layout it belongs to.

Two things worth knowing about the shape of it. `SiteHeader`, `PricingTable`
and `AuthForm` are client components and cannot read the flag, so they take it
as a required prop from their server parent, threaded through all seven pages
that render a header. And the pricing page's static `metadata.description` no
longer mentions the first week at all, because a claim baked into a search
result cannot branch.

**The launch discount has its own announcement bar** (`src/components/announcement-bar.tsx`),
added 2026-09-12 on Davide's call. The offer panel shows the **list** price,
not the discounted one: an earlier pass quoted 231.20 on the reasoning that
every signup today holds the discount, and the correction is that a site which
quietly quotes the discounted number has nothing left to say when it wants to
point out there is a discount. So the list price stands and the bar carries the
offer, once, where it applies to every plan. It is gated on
`earlyAdopterProgramActive()`, so it disappears on its own when the window
closes. It says nothing about scarcity, because there is no deadline and no
seat count, only a flag.

**One trap if that bar is ever edited.** It lives inside the FIXED header, whose
height is reserved by a spacer of a hardcoded size, so a bar that wraps to two
lines pushes the header over the page content. Measured before it was fixed:
three lines at 375px and 36px of overlap, enough to clip the first heading on
the terms and privacy pages. Hence a short form below `sm` rather than one
string left to reflow. Verified at 375, 768 and 1278 with the header and spacer
heights read off the live DOM.

Verified in both states by running the site with the flag on and off and
diffing what each surface says. With it off, nothing changed. `/terms/refunds`
is statically prerendered, so the flag still needs a redeploy, not just the
variable.

**Deferred, Davide's own idea (2026-09-12), explicitly not now:** if a penalty
ever returns, it could cost something other than money, such as reduced
functionality. That keeps the stakes without the chargeback, the cross-border
enforceability problem or the category weirdness. Worth taking seriously the
next time activation is the binding constraint.

---

## Track H, what is still owed

**Updated 2026-09-12.** Two of the four are closed; the two left both need
Davide rather than code.

**The build itself is complete and was audited against the spec table above on
2026-09-12**, row by row, after the 3-D Secure fix: signup deposit, commitment,
terms figures, full Pro during the week, cancel-owes-nothing, day-7 convert with
the 20% coupon, per-step fees under the cap, nudges on 2/5/6, the make-good
sweep and the `/admin` waiver are all present and wired. The three activation
stamps fire from the real action sites (import route, services form, campaign
approval), first-write-wins. **There is no code left to write for Track H.** The
two items below are not build work.

0. ~~The marketing copy still says "free week, no card".~~ **Done 2026-09-12**,
   see above. Every public price claim now branches on the flag.
1. ~~The terms pages do not mention the fee.~~ **Done**, commit `6734bb1`, then
   rewritten again on 2026-09-12 for the paid week: the fee paragraphs are gone
   and it now states the 1 euro, that it is non-refundable because the week
   begins immediately, the renewal, and that cancelling costs nothing.
   `/terms/refunds` now reads `CASDEY_TRIAL_PENALTY` and `src/lib/trial.ts`
   directly, so it states the €1, the €20-a-step fee, the €60 cap, the waiver
   and the make-good refund, and says plainly that accounts opened before the
   change keep the no-card terms. With the flag off it renders exactly what it
   said before. The page is statically prerendered, so flipping the flag needs
   a redeploy for the page to change as well as the behaviour.
2. **Nothing has been through the LIVE Stripe path.** Still open, and it is the
   real gate. Everything is verified in test mode. Do one real €1 and one real
   conversion on a real card, the way C1 was done.
3. ~~Legal shape of the fee is unexamined.~~ **Researched 2026-09-12, and it is
   why the fee was dropped.** See the ledger for Ireland (Dunlop, not Makdessi)
   and Germany (307 BGB voids an unfair B2B standard term entirely). **What the
   research surfaced instead is bigger than Track H and is still open: casdey
   almost certainly needs a Partita IVA already.** Italian *prestazione
   occasionale* requires the activity to be non-abituale, and recurring
   subscriptions with a published site and daily outreach is habitual and
   organised, which makes a P.IVA obligatory regardless of amount (Agenzia delle
   Entrate interpello 63/2024 treats repetition over time, even with one client,
   as a strong indicator). That gates real revenue whether or not the flag ever
   goes on, and it needs a commercialista rather than more research.
4. ~~`?started=1` claims nothing is charged.~~ **Done**, commit `6734bb1`.


### Where the build departed from this spec

Recorded because both were decisions taken while building, not things this plan
asked for.

- **The flag.** `CASDEY_TRIAL_PENALTY`, default off, is not in this plan. The
  plan assumed Track H ships and runs. It was added because the mechanism takes
  money off a real card at signup and the live Stripe path had never been
  exercised. Consequence: Track H is deployed and inert, and switching it on is
  one Vercel variable plus a redeploy.
- **The week now starts when the card is saved, not at signup.** This plan's
  table says "Signup: €1 charged now" and does not say when the seven days
  begin. `recordTrialCard()` starts them, on the reasoning that the card is the
  commitment so the week it buys cannot precede it. The cost is that a gym which
  abandons the card step gets no free week at all and lands on Free, which still
  imports and still shows who has gone quiet. Reversible if that trade is wrong.
- **Nudges require a card on file.** This plan says days 2, 5 and 6 without
  qualification. `nudgeDue()` now also requires `trial_card_setup_at`, because
  the nudges name the setup fee and a gym with no card can never be charged one.
  Added after the incident recorded below.

### The 3-D Secure bug, found 2026-09-12, FIXED the same day

**What it was.** A day-7 conversion whose off-session charge needs 3-D Secure
leaves the Stripe subscription `incomplete`. `stripe.subscriptions.create()`
defaults to allowing that, `mapStatus()` maps it to `incomplete`, and
`effectivePlan()` treated only `active` and `past_due` as paid, so the gym
resolved to **Free**. Meanwhile `convert()` stamped `trial_converted_at`, closed
the trial and reported success.

Net effect: a gym that finished all three steps ended up on the Free plan with
an unpaid subscription, casdey's own records saying it converted, and nothing
telling it to authenticate. Stripe's test cards never trigger 3-D Secure, which
is why test-mode verification could not surface this and why only a real
European card would have.

**The fix** (commit `dfd4049`), in four parts:

- `conversionResultFor()` in `src/lib/trial.ts` is the one place that decides
  what a created subscription means: `converted`, `needs_authentication`, or
  `failed`. Pure and tested, because the status check is the whole bug.
- `convert()` stamps `trial_converted_at` only on a real conversion, so casdey's
  records can no longer claim a payment that did not happen. It still closes the
  trial either way, because the trial genuinely ended and leaving it open would
  have the next daily run create a **second** subscription for the same gym.
- `effectivePlan()` keeps an `incomplete` subscription on its paid tier instead
  of dropping it to Free. Sending stays blocked throughout, since
  `capabilities()` clears that gate only for `active`, and the exposure is
  bounded by Stripe expiring an unconfirmed subscription within about a day.
- The gym is told. A new `sendTrialAuthNeeded()` emails the hosted invoice link,
  and the banner and billing page say the bank needs approval rather than
  telling a gym with a perfectly good card to go and update it. The job reports
  `pendingAuth` and `conversionFailed` separately from `converted`.

**Still true, and it is why item 2 of "what is still owed" above matters:** none of
this has met a real 3-D Secure prompt. The logic is unit-tested and the copy
builds, but the actual bank round trip has never run. That is what a live
conversion on a real European card would prove.

**Known and deliberately left:** `/admin` still buckets an `incomplete` gym
under "free" in its status counts. It understates rather than overstates
revenue, which is the safe direction, so it was not worth widening the fix.

**A separate incident, already fixed, worth not repeating:** the first run of
this job emailed casdey's only real customer about a setup fee it had never
agreed to. It had no card on file and so could never be charged, but the nudge
did not check. See the third deviation above, plus the regression test in
`src/lib/trial.test.ts` that names it.

Also worth knowing: a fee charged to an `is_internal` gym is invisible
everywhere, because `/admin` excludes internal gyms from every number
including this one. Correct for business figures, mildly confusing while
testing.

---

## Track I, the lapse window default

**DONE 2026-09-12, commit `83a4713`. Migration `0037` applied to the live DB.**
The default is now 90 days, it is an explicit choice rather than an
inheritance (`gyms.lapse_rule_set_at`), and Settings counts what each
candidate window would catch in the gym's own members. Two bugs were found
while verifying it: the "not set yet" notice named the shipped default rather
than the gym's own window, and the settings form came out of every save with
its unit reset to "months". Not pushed.

**A real bug, found 2026-09-10.** `gyms.lapsed_after_months` defaults to **12**
(`supabase/migrations/0002_saas.sql:117`). That is a dental recall cycle that
survived the pivot to gyms untouched.

Consequence: a gym imports its list and casdey only flags members who have not
visited in a year. For a CrossFit box or a boutique studio, a member gone 8 to 12
weeks is lapsed. So a new gym's very first screen shows a near-empty lapsed list
and a near-zero recovered-revenue figure, and the Value Equation term casdey is
strongest on, the fast early win, fails silently on arrival. BodyActive is
sitting on this default right now.

Fix, in two parts:

1. Change the default to something gym-native. Recommended: **90 days**
   (`lapsed_after_days = 90`), which the existing `0022` override column already
   supports. Constraint to respect: `at_risk_after_days < lapsed_after_months *
   30`, so the months column has to stay consistent.
2. Make the lapse window an explicit choice during onboarding rather than an
   inherited default, so the gym sets it deliberately while looking at what it
   does to their numbers.

Cheap, and it gates whether Track H's activation steps produce anything worth
seeing.

---

## Track J, the guarantee on the reply side

**DONE 2026-09-12, commit `0694b35` on branch `gym-outreach-automation`.**
The section needed more than a port: nearly every figure in it was stale
("once the software ships", £250/€290, the £50/€59 discount, "Premium"), and
it described a guarantee casdey never built ("100% refund plus free software
until the condition is met"). Rewritten against what the product actually
does, with the Standard-versus-Pro framing below as the reply-side script.
Not pushed.

**Decided 2026-09-10.** Where risk reversal belongs, per the books.

The cold first-touch email carries **no guarantee**, and neither do the
follow-ups. That is not a compromise, it is where Hormozi puts it. Guarantees are
a Perceived Likelihood element ($100M Leads pg 89) and belong wherever the offer
is made. casdey's cold touch deliberately makes no offer, it is a feedback ask,
so there is nothing for a guarantee to reverse the risk of. What touch one
carries instead is Big Fast Value ($100M Leads pg 169-171), the free setup on
their lapsed list, which is already live as variant B.

**No changes to the live email routine or the follow-ups.** The 2026-08-23
feedback-first call stands and is book-consistent.

What changes is the reply-side script, where the offer actually gets made. Do not
say "we offer a guarantee". Frame it as the choice, per the Prepay + Guarantee
pattern ($100M Leads pg 101):

> Same product on Standard and Pro. Standard is €99 a month, cancel any time.
> Pro is €289 and it carries this: if casdey doesn't recover more than it cost
> you over your first 30 days, you refund yourself the whole thing from your
> billing page. One click, no review, no email, no argument. That risk sits with
> me, not you. The guarantee is basically the only difference between the two.

Rules:
- State the gym's **actual lapsed-member value**, taken from their own Free-tier
  screen, next to the price. Numbers, not adjectives.
- The guarantee rewards the more committed buyer. Pro and annual get it,
  month-to-month Standard does not, and saying so plainly is the point.

**To do:** port this into `.claude/skills/gym-outreach/SKILL.md`, section "The
full offer", on branch `gym-outreach-automation`. It is captured here so it is
not lost on main in the meantime.

---

## Track K, gym #1 to a case study

Operational, Davide-led, not code. The highest-leverage single item in the whole
diagnosis, because Perceived Likelihood is casdey's weakest Value Equation term
and it is currently a structural zero: no case study, no testimonial, no number
from a real gym.

BodyActive Skibbereen is the only candidate. Davide emailed them on 2026-09-10
offering done-for-you setup. Sequence from here:

1. Get their real member export.
2. Do the import, prices, offer and first campaign personally.
3. Get to a first booked member, which is the first real result casdey has ever
   produced for anyone.
4. Then, and only then, ask for the testimonial and permission to use the
   recovered-revenue number.

This also produces the first real answer to whether the LegitFit CSV path works
(`SAAS_V1_PLAN.md` B4/E2).

---

## Deliberately not in V1.1

Recorded so nobody picks these up thinking they were forgotten. All are real, all
are in the ledger's standing gaps, and all are premature until a few gyms are
paying. Hormozi's own sequencing: create flow, monetise flow, then add friction.
There is no flow yet.

- Downsell and upsell tiers, and any re-pricing
- A named offer in MAGIC terms
- Honest scarcity or urgency beyond the launch-window discount
- The referral engine and any other Lead Getters
- Paid ads, and the LTGP:CAC work that must precede them
- A second or third outreach channel, the "New" in More/Better/New

Outreach volume also stays exactly as it is: 100 first-touch a day plus uncapped
follow-ups, held Open to Goal until the first three paying gyms. The machine was
ramped on 2026-09-08 and needs 60 to 90 days before its output means anything.
Do not retune it on weekly noise.

---

## Open questions

- ~~Why did 8 of 11 replies die?~~ **Answered 2026-09-10.** They say "no thanks",
  "not interested", "not for me". Genuine disinterest, not a reply-side process
  gap, so the build order here stands. The second-order finding matters more: the
  cold email is feedback-first so that it gathers data, and a brush-off is not
  data. Nobody said "interesting, but X" or "we already use Y". A feedback
  request is an ask, not a give, and value flows the wrong way for a stranger
  ($100M Leads pg 169-171). first-touch variant B is already the give, and test
  T0 is testing ask against give right now, so let it run rather than acting.
  Expect B to win; if it does, make B's give bigger rather than keeping A.
  n=11 is far too small to read a verdict into either way.
- **Does the €1 charge hurt signup rate?** Unknown and unknowable at n=1.
  Hormozi's hedge if a free-plus-card ask gets weird reactions is exactly this
  €1 (MM pg 129), so it is already the mitigation. Watch it once there is volume.
- **CrossFit and community boxes are ~9 of 13 responders.** The sourcing mix is
  already reweighted to 40%. Whether it should go further is a "more" decision to
  make after the current volume ramp produces data.
