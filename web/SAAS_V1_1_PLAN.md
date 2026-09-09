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

## Track I, the lapse window default

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

- **Why did 8 of 11 replies die?** The sheet records the status, not the reason.
  Davide has the inbox context. If they were genuine "not interested", that is a
  targeting signal. If they went cold after one exchange, that is a reply-side
  process gap and it is more urgent than anything in Track H, because those
  people had already raised their hand. Worth 20 minutes reading the thread.
- **Does the €1 charge hurt signup rate?** Unknown and unknowable at n=1.
  Hormozi's hedge if a free-plus-card ask gets weird reactions is exactly this
  €1 (MM pg 129), so it is already the mitigation. Watch it once there is volume.
- **CrossFit and community boxes are ~9 of 13 responders.** The sourcing mix is
  already reweighted to 40%. Whether it should go further is a "more" decision to
  make after the current volume ramp produces data.
