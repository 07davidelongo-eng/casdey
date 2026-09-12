# casdey × Hormozi — decision ledger

The running record of how casdey maps to Hormozi's frameworks, and every place
casdey has **deliberately diverged** and why. Read this before giving advice so
you don't reopen a settled question or contradict a prior call. Append a dated
entry whenever a real business decision is made through this lens.

Entry format:
```
## YYYY-MM-DD — <short title>
Framework: <book / framework piece>
Decision: <what was decided>
Follows or diverges: <follows | diverges | partial>
Reason: <why casdey's situation justifies it>
```

---

## 2026-08 — Cold outreach instead of warm outreach
Framework: $100M Leads / Core Four sequencing ("warm outreach first")
Decision: casdey's primary channel is cold outreach (automated cold email +
manual IG DM), with no warm-outreach phase.
Follows or diverges: **Diverges** (accepted).
Reason: Davide has no warm list among gym/studio owners — no prior customers,
no personal network in the niche. Warm outreach needs people who already know
you; casdey had none to work. Cold fit the actual situation and Davide's
personal circumstances. Hormozi's own rule is "follow the facts of your
business"; the facts pointed to cold. Do not keep re-suggesting warm outreach
as if it were an oversight.

## 2026-09-03 — Three tiers, EUR-led, premium Pro price
Framework: $100M Offers / pricing; go-to-market notes ("Free, Starter, Pro")
Decision: Free €0 / Standard €99 / Pro €289 per month, pricing leads in EUR
(GBP kept as its own round numbers). Lifetime 20% early-adopter discount on
either paid tier.
Follows or diverges: **Follows.**
Reason: Premium Pro price is intentional per Hormozi (raises perceived value,
funds the guarantee, filters for committed gyms). EUR-led because casdey's
market is Europe and Davide works in EUR. The early-adopter discount is framed
as time-bound access, not a standing price cut.

## 2026-09 — Free tier as the lead magnet
Framework: $100M Leads / lead magnets
Decision: the Free tier (import list, see lapsed members and their value, no
sending) is treated as casdey's lead magnet, not just a pricing floor.
Follows or diverges: **Follows.**
Reason: it's a complete small win (the recovered-revenue number), it reveals
the next problem (now actually win them back), and that next problem is what
the paid tiers solve. Well-formed lead magnet in Hormozi's terms.

## 2026-09-07 — Marketing plan built on More / Better / New
Framework: $100M Leads / More-Better-New, Rule of 100
Decision: outreach scaling follows More (100/day first-touch + uncapped
follow-ups), Better (one weekly A/B test per asset, cumulative test log, 4
unbeaten tests = established winner), New (deferred).
Follows or diverges: **Follows**, closely and explicitly.
Reason: this is the framework applied on purpose; the "Marketing plan
(Hormozi)" section of `CLAUDE.md` is the live spec.

## 2026-09-09 — Skill built and references distilled from a full read
Framework: all three books
Decision: `/hormozi` skill created; the three books OCR'd to text in
`Alex Hormozi/` (gitignored) and `references/{offers,leads,money-models}.md`
rewritten from a complete read, each with a casdey-application section.
Follows or diverges: n/a (infrastructure).
Reason: Davide's request — make Hormozi's frameworks the working lens for
casdey business decisions. Davide has read Offers and Leads; Money Models is
still on his list, so lean on him less for that one.

## 2026-09-10 — Diagnosis: the binding constraint is leads (volume + reply→activation), not the offer or the money model
Framework: $100M Leads / constraint sequencing + More-Better-New + Rule of 100;
$100M Offers / Value Equation (Perceived Likelihood); $100M Money Models /
Trial With Penalty
Decision: first full Hormozi-lens diagnosis of casdey. Verdict — monetisation
is **not** the constraint (0 paying gyms; unit economics are strong: 92–96%
gross margin, break-even at one gym). The offer is sound on paper and the
CrossFit/box reply cluster (≈9 of 13 responders) shows real demand. The
**binding constraint is leads**, in two parts: (a) absolute engaged-lead
volume is tiny — 13 responses / ~677 first-touched ≈ 1.9%, only 1 ever marked
"Interested"; (b) the fatal drop is **reply → activation** — 8 of 11 replies
went Dead, and the one genuine signup (BodyActive Skibbereen, 2026-09-08)
imported zero members, set no prices, ran no campaign, and is letting the free
week run out. Agreed moves, run in parallel with holding the 100/day
Rule-of-100 first-touch volume (already ramped 2026-09-08, leave it alone and
go Open-to-Goal to the first 3 paying gyms):
  1. Hand-hold gym #1 (BodyActive) to a first result and a testimonial —
     done-for-you setup, treat as design partner. Time-critical: trial ends
     2026-09-15.
  2. Build a **reply → activation path**: onboarding checklist (import → prices
     → offer → approve first campaign) + trial-window nudge emails + funnel
     events so the drop-off is measurable. The free week is currently a
     no-stakes trial, the exact version Hormozi (Trial With Penalty) says
     people don't use and don't convert from.
  3. Make the **guarantee louder and more concrete** on the reply side (it is
     the only thing carrying Perceived Likelihood until a testimonial exists).
Explicitly deferred as premature until there are a few paying gyms: downsell /
upsell tiers, re-pricing, a named (MAGIC) offer, scarcity / urgency, the
referral engine, paid ads, a second outreach channel ("New").
Follows or diverges: **Follows**, with one deliberate nuance — Hormozi says
under $1M profit do "More" then "Better" sequentially; casdey runs More
(volume, already ramped) and the proof/activation fixes **in parallel**,
because Perceived Likelihood is a structural zero (no testimonial, no case
study) rather than a percentage optimisation, and a ~5-figure-ARR B2B purchase
can't be brute-forced on raw volume the way a B2C challenge can.
Reason: constraint analysis against real numbers pulled from the live
`Casdey-Gym-Leads` sheet and the production database on 2026-09-10.

## 2026-09-10 — Trial With Penalty replaces the no-stakes free week (reverses "no card")
Framework: $100M Money Models / Trial With Penalty (pg 121-130)
Decision: the 7-day free week becomes a Trial With Penalty. **€1 charged at
signup** (Hormozi's own hedge, pg 129, so the card ask is justified and the card
is proven before real billing), card saved, an affirmative "if casdey brings
members back, will you stay on?" commitment step, and terms stating the week is
free as long as setup is completed. Three activation criteria: import the member
list, set service prices, approve the first campaign. At day 7: all three done
and not cancelled → **auto-converts to Pro €289/mo** with the 20% early-adopter
coupon (convert to what they trialled, per "always sell staying and paying",
pg 125); cancelled at any point → drops to Free with **no fee**; steps unfinished
and not cancelled → **€20 per unfinished step, €60 cap**, then Free. Fees are
per-step not lump (pg 124), waivable from `/admin`, and auto-refunded if the step
is completed within 7 days (pg 128, "let people make up for goofs"). Called a
"free trial" in all gym-facing copy (pg 129). Full spec: `web/SAAS_V1_1_PLAN.md`
Track H.
Follows or diverges: **Follows**, with one adaptation. Hormozi sells this on a
call, taking the card by hand and explaining the fee *after* the card is down
(pg 126). casdey's signup is self-serve, so the fee terms must be shown plainly
up front instead, and the design leans harder on nudge emails (trial days 2/5/6)
and the waive-on-a-call hatch. Weaker than the in-person version, far stronger
than what it replaces. Also a deliberate softening: a gym that **cancels** owes
no fee even with steps unfinished, because the fee targets the ghost who sat on a
free week, not the decliner, and billing a decliner is the "not worth a 1-star
review" case (pg 128). Accepted loophole: use Pro six days, cancel, pay €1.
Reason: **this reverses the settled 2026-08-14 billing decision** ("7-day free
week, no card taken, then drops to Free"). That design is precisely the
no-stakes free trial Hormozi says people do not use and do not convert from, and
casdey now has a live proof of the failure mode: BodyActive Skibbereen signed up
2026-09-08, signed in once, imported nothing, and would have reached day 7 having
seen the product do nothing. The Free tier is not retired, it stops being the
default destination and becomes the cancel-landing and downsell, while remaining
the lead magnet for anyone who never starts a trial. Davide's call, made
explicitly ("I would go full Hormozi... I want to stick with Alex's advice"),
with the €20 step fee his own adjustment from the €24 proposed.

---

## Standing gaps (not yet decided — candidates for a Hormozi-lens session)
Ranked roughly by leverage.

- **Proof / perceived-likelihood — the weak Value-Equation variable.**
  **IN FLIGHT 2026-09-10 as V1.1 Track K.** No case study, no testimonial. The
  whole offer leans on the Pro guarantee for believability. Fix in progress: get
  BodyActive Skibbereen to a first result via done-for-you setup, then a
  testimonial. Still the highest-leverage open item until that lands. Gates
  referrals too (Leads: product good enough for referrals before scaling paid).
- ~~**The free week is a no-stakes free trial**~~ — **DECIDED 2026-09-10**, see
  the Trial With Penalty entry above and `web/SAAS_V1_1_PLAN.md` Track H. €1 +
  card + three activation criteria + €20/step fee, auto-converting to Pro. The
  Free tier keeps its lead-magnet job for anyone who never starts a trial and
  becomes the cancel-landing rather than the default destination.
- **No downsell** in the money model. A gym that balks at €99 has no
  structured step below Free. Candidates (Money Models): feature-downsell to a
  Standard-minus (email only, smaller cap), a single-campaign / seasonal
  "win-back one list" one-off, annual prepay at a steeper discount (CFA cash
  pull), or making the "keep the guarantee → pay Pro / drop it → pay Standard"
  framing explicit at a price objection.
- **No active upsell at point of sale.** Candidates: paid done-for-you
  onboarding / first-campaign build at the moment of upgrade (hyper-buying
  window, also fixes activation); an enterprise/multi-site anchor price shown
  first so €289 Pro reads as the middle.
- **No named offer.** casdey's public offer is a CTA ("Start your free week"),
  not a named offer (Offers / MAGIC: Avatar + Goal + Interval + Container).
  Low-cost upside for outreach and the pricing page.
- **No honest scarcity / urgency** beyond the launch-window discount. Available
  and unused: onboard N gyms per month while onboarding is manual (WhatsApp is
  hand-onboarded per gym anyway); cohort-style starts would also smooth ops.
- **No Lead Getters active.** Referrals first (Leads: aim 25%+ of gyms from
  referral before scaling paid). Go-to-market notes already flag a referral
  push at conversion-to-paid. Rollover/winback (Money Models) applies to
  casdey's own future churned gyms and to competitors' unhappy customers.
- **LTGP:CAC / CFA never computed from real data.** Must be done before any
  paid acquisition. CFA question: does a new gym's month-one gross profit
  cover CAC + serve ~2×? Plausibly yes at €99–289/mo with low COGS.
- ~~**The constraint is reply → engaged**~~ — **SUPERSEDED 2026-09-10.** Fresh
  numbers moved it: the reply rate (~1.9%) is producing responses, but 8 of 11
  replies went Dead and the single signup activated nothing. The binding drop is
  **reply → activation**, not reply → engaged. Track H attacks the activation
  half; the reply half is still open (see below).
- ~~**Why 8 of 11 replies died**~~ — **ANSWERED 2026-09-10.** Davide read them:
  they say "no thanks", "not interested", "not for me". Genuine disinterest,
  **not** a reply-side process gap, so the V1.1 build order stands (Track I, then
  Track H). The second-order finding is the useful one: the cold email is
  feedback-first *precisely so it gathers data*, and a brush-off is not data.
  Nobody replied "interesting, but X" or "we already use Y". In Hormozi's terms a
  feedback request is an **ask**, not a give, so value flows the wrong way for a
  stranger who owes you nothing (Leads pg 169-171). His own worked example is
  this exact swap, from a "game planning session" to "as much free service as we
  could possibly afford", which 3x'd take rates. casdey already has the give as
  first-touch **variant B**, and **T0 is literally testing ask (A) vs give (B)**,
  so let it run rather than acting now. Expect B. If B wins, the "more" move is
  to make B's give *bigger*, not to keep A around. Caveat against over-reading
  any of this: n=11 is nothing, and Hormozi says his own first four months of
  cold outreach "felt like torture".

## 2026-09-12 — Trial With Penalty built, and three places the build had to decide for itself
Framework: $100M Money Models / Trial With Penalty (pg 121-130), same entry as above
Decision: Track H is built, deployed and **switched off** behind
`CASDEY_TRIAL_PENALTY`. Three judgement calls the 2026-09-10 decision did not
cover, all made while building:

1. **The flag itself is not Hormozi's, and not Davide's.** The agreed plan
   assumed the mechanism ships and runs. It was gated because it charges a real
   card at signup and the live Stripe path had never been exercised. Hormozi
   would say ship it; the counter-argument is that a broken live checkout on the
   first signup in weeks costs more than a fortnight of delay, at roughly one
   signup a month. Davide's to reverse, and he has queried it.
2. **The week starts when the card is saved, not at signup.** Keeps the
   commitment and the thing it buys in the right order. Cost: a gym that
   abandons the card step gets no week at all.
3. **Nudges only go to gyms with a card on file.** Not in the book and not in
   the plan. Forced by an incident: the first run of the job emailed casdey's
   only real customer about a setup fee it had never agreed to, having signed up
   before any of this existed. This is pg 128 ("a small fee isn't worth a 1-star
   review") applied one layer earlier, to the *warning* rather than the fee.
Follows or diverges: **Follows on the mechanism, diverges on tempo.** The
mechanism is built as specified. What diverges is that it is not live, which is
a deliberate softening of Hormozi's "ship the offer" instinct in favour of not
testing a payment path on a real customer. Worth revisiting the moment the live
Stripe run is done, because the longer it sits off the more the diagnosis it came
from goes unanswered.

## 2026-09-12 — Track H is an activation fix, not monetisation friction. Do not reopen it on "add friction" grounds
Framework: $100M Offers / "Create flow. Monetize flow. Then add friction."
(sales-to-fulfilment continuum); $100M Money Models / Trial With Penalty
Decision: recorded because a session reopened this and was wrong, and the same
misreading is easy to repeat. While reporting Track H as built, Claude argued
the flag should wait for lead volume, on the grounds that Hormozi puts friction
after flow and casdey has one signup. Davide challenged it. Re-checked against
the source, the objection does not survive:

- **The maxim is about something else.** It sits in *$100M Offers* under the
  sales-to-fulfilment continuum, in the trimming and stacking discussion. The
  friction it defers is doing less per customer and tightening marketing once
  demand already flows. Its own worked example argues the opposite of caution:
  do MORE for each customer while cash is coming in. The V1.1 plan already
  applies it correctly, to the "Deliberately not in V1.1" list (scarcity,
  urgency, re-pricing, referrals, paid ads, a second channel). Track H is not
  in that list and does not belong in it.
- **The diagnosis had already placed Track H.** The 2026-09-10 entry puts the
  binding constraint in leads, in two parts, and names the fatal drop as reply →
  activation. Track H is move #2 on that list, the reply → activation path. It
  was never classified as monetisation.
- **The plan already contains the steelman and answers it.** Open questions:
  "Does the €1 charge hurt signup rate?" The €1 *is* the mitigation (MM pg 129),
  chosen precisely because a card ask on a free trial gets weird reactions. The
  instinct that a card ask is too much friction at low volume is the exact
  instinct that chapter exists to argue against.
- **There is no trade-off with Track K.** Track H cannot touch BodyActive, who
  signed up before it existed with no card on file. Turning it on costs the case
  study nothing.
Follows or diverges: **Follows.** The correction restores the 2026-09-10
position; it does not change it. What remains gating the flag is a live Stripe
run and the legal question, both real and neither about sequencing.
Reason: source checked at `Alex Hormozi/100M-Offers.txt` rather than recalled.

## 2026-09-12 — The setup fee is dropped. The week is sold for 1 euro instead
Framework: $100M Money Models / Trial With Penalty (pg 121-130). DIVERGES.
Decision: Track H ships without the fee. Signup takes a card and charges 1 euro
for seven days of Pro; at day 7 the subscription begins unless the gym
cancelled. The activation steps, the commitment ask, the checklist and the
nudges all stay. What is deleted is the 20 euro per unfinished step, its cap,
the make-good refund and the admin waiver.

Davide's call, and the reasoning is his: he has never seen this in any software
he uses, and was not convinced it fits casdey. That is not squeamishness, it is
a category mismatch, and checking it out confirmed three things:

1. **The fee has no cost basis in SaaS.** Trial With Penalty comes from Gym
   Launch, where an unused trial consumes a coach's hour and the fee recovers a
   real loss. A dormant casdey trial consumes no Anthropic tokens, no Resend
   quota, no Twilio messages and no support. An earlier session claimed 60 euro
   against "72 euro of Pro consumed" was clean proportionality; that is list
   price, not cost, and the legal tests ask about loss.
2. **Ireland, where casdey's only customer is, is the worst venue for it.**
   Ireland has **not** adopted Cavendish v Makdessi (Sheehan v Breccia; bound by
   Pat O'Donnell v Truck and Machinery Sales [1998]) and still applies Dunlop,
   under which a deterrent clause is the classic unenforceable penalty. Makdessi
   is the case that rescues deterrent clauses via "legitimate interest", and it
   does not apply there. casdey's own stated rationale was explicitly deterrent.
   Germany's 307 BGB polices B2B standard terms too, and voids an unfair clause
   entirely rather than reducing it.
3. **The thing that was doing the work is not the fee.** The diagnosis of
   2026-09-10 condemned "a free trial with no card and no required actions". The
   card, the 1 euro, the commitment and the checklist all remain, and day 7 still
   forces a decision, which is the property the old free week lacked: it expired
   quietly, the gym drifted to Free, and nothing happened. That is exactly what
   BodyActive did.

Follows or diverges: **Diverges, deliberately.** Hormozi's mechanism assumes a
consumer, a human taking the card on a call, one jurisdiction, and a real cost
incurred by a no-show. casdey is self-serve, B2B, cross-border and has no legal
entity to defend a contested fee with. Per this skill's own rule, the facts
differ from the book's assumptions, so the facts win. The 1 euro survives
because it is Hormozi's own hedge (pg 129) and it does the commitment work.
What this gives up, stated plainly: nothing now forces the three activation
steps between day 1 and day 7 except an imminent Pro charge. The nudges are
therefore the whole activation mechanism and were rewritten to lead with what
the gym is not seeing, and day 6 became a conversion warning naming the exact
amount.
Reason: Davide's judgement on category fit, plus legal research into the Irish
and German positions, plus the observation that the fee had no cost basis.

**Not closed, for the future:** Davide's own idea, raised the same day and
explicitly not for now, is that if a penalty ever returns it could cost
something other than money, such as reduced functionality. That keeps the
stakes without the chargeback, the cross-border enforceability question or the
category weirdness. Worth taking seriously whenever activation is the
constraint again.
