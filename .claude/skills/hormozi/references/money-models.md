# $100M Money Models — distilled for casdey

Notes on Hormozi's monetisation framework, in my words, with a casdey section
at the end. This is the newest book (2025) and Davide hasn't read it yet, so
this file leans partly on public summaries and should be checked against
`Alex Hormozi/100M-Money-Models.pdf` when a decision turns on a detail. Flag
anything here you confirm or correct against the book.

## Contents
- The core idea
- Client-Financed Acquisition and the 30-day rule
- The four offer roles
- The three stages
- Named tactics
- casdey application

## The core idea

A "money model" is the deliberate *sequence* of offers a customer moves
through — how you acquire them, what you sell next, what you sell to a "no",
and what keeps billing — engineered so the cash a customer produces early
outruns what it cost to get and serve them. Most businesses have one offer and
hope lifetime value eventually justifies acquisition cost. A money model makes
the customer pay for their own acquisition fast, so growth self-funds instead
of needing outside cash or patience.

## Client-Financed Acquisition (CFA) and the 30-day rule

- **CFA**: structure the offer sequence so that within the first **30 days** a
  customer's **gross profit** covers the full cost to **acquire + deliver**
  them — ideally covers it about **2×** over.
- When that holds, every customer throws off enough cash in month one to fund
  acquiring the next one (or two), and you can scale as fast as operations
  allow without running out of money.
- The lever isn't just price — it's the *timing* of cash. Pull revenue
  forward (upfront offers, prepay, upsells at point of sale) so the payback
  window shrinks below 30 days.
- Related to LTGP:CAC from *Leads*, but sharper: LTGP:CAC asks "is this
  profitable eventually"; CFA asks "is this profitable *this month*". A
  business can pass the first and fail the second and still stall for lack of
  cash.

## The four offer roles

A full money model has one of each, working together:

1. **Attraction offer** — converts a cold stranger into a paying customer.
   Priced and framed to be near-irresistible and at least break even on
   acquisition. Examples of the *shape*: a low-priced entry offer, a paid
   trial, a "starter" package, a challenge. Its job is to get the first
   "yes" and cash in the door, not to be the main profit.
2. **Upsell offer** — immediately after the first yes, sell the thing that
   increases cash collected now: a bigger package, done-for-you, faster
   results, more scope. Point-of-sale upsells are the biggest lever on 30-day
   cash because the buyer is already buying.
3. **Downsell offer** — for the people who say no to the main offer, a
   modified version that turns the no into a yes: less scope, payment plan,
   lower price, self-serve instead of done-for-you, a smaller first step. A
   downsell recovers revenue you'd otherwise lose entirely.
4. **Continuity offer** — recurring billing that keeps going automatically:
   subscription, membership, retainer, consumable re-order. This is where
   long-term value compounds once the early cash has covered acquisition.

## The three stages

Hormozi sequences the build:

1. **Get Cash** — get the attraction offer to where acquisition at least
   breaks even (cash from new customers ≥ cost to get them). Until this holds,
   nothing else matters; you're funding losses.
2. **Get More Cash** — add upsells and downsells to maximise gross profit in
   the first 30 days. This is the stage that makes acquisition
   *self-financing* rather than merely break-even.
3. **Get The Most Cash** — add/strengthen continuity so the relationship
   compounds. Recurring revenue is the payoff, but it's built last because it
   doesn't help if you can't afford to acquire the customer in the first
   place.

Don't skip to stage 3. A great subscription you can't afford to sell is not a
business.

## Named tactics

Offer structures the book catalogues (shapes to reach for, not all relevant to
every business):

- **Win Your Money Back** — customer earns a full refund by hitting a defined
  goal (getting a result, or completing defined actions, or both). Drives
  action and completion, filters for serious buyers; only works if the
  goal/actions are simple to track.
- **Giveaway** — advertise a grand prize for contact info, pick one winner,
  then offer everyone else the core product at a discount.
- **Decoy offer** — a deliberately worse-value option that makes the target
  option look obviously right.
- **Buy X Get Y** — bundle/volume framing that raises units per sale.
- **Pay Less Now** — take less upfront to lower the barrier, with the balance
  or full rate coming later (shifts a price objection without discounting the
  real price).
- **Free with consumption / free trial with penalty** — free or near-free to
  start, with a cost to *not* follow through (a card on file, a commitment,
  a penalty for no-show), which lifts completion versus a no-stakes free
  trial.

## casdey application

Where casdey stands. Confirm specifics against the book before betting on them.
Keep in sync with `web/SAAS_V1_PLAN.md` §F0, `casdey-hq.md` and the ledger.

- **Current model shape:** basically **attraction + continuity, no upsell, no
  downsell.**
  - Attraction: the free week (full Pro features, no card) → Free tier.
  - Continuity: Standard €99/mo or Pro €289/mo subscription.
  - Upsell: only the passive Free→Standard→Pro path and Standard→Pro. No
    active point-of-sale upsell.
  - Downsell: none. A gym that won't pay for Pro isn't offered a structured
    smaller step beyond "stay on Free".
- **CFA / 30-day read:** casdey's continuity price is high (good for payback)
  and COGS per gym is low (email + a little AI + infra), so gross margin is
  strong. But CAC is currently all founder time and there's no paid
  acquisition, so the 30-day math isn't a live constraint yet. It *becomes*
  the key question the moment paid ads or paid Lead Getters are considered —
  at that point: does month-one gross profit from a new gym cover CAC + serve,
  ~2×? With a €99–289/mo price and low COGS, plausibly yes, which would make
  paid acquisition viable earlier than for a cheap SaaS.
- **The free week vs "free trial with penalty":** casdey's trial takes no card
  and has no penalty for not converting — the no-stakes version Hormozi is
  lukewarm on. A card-on-file trial would lift trial→paid conversion but adds
  signup friction, which fights the lead-magnet job of the Free tier. Live
  tension worth a deliberate call, not an accident.
- **Missing downsell:** the clearest gap. Options that fit casdey: an annual
  prepay at a steeper discount (pulls cash forward, CFA-friendly), a
  "done-with-you first campaign" paid setup, or a lower-priced
  single-campaign / seasonal offer for gyms that won't commit monthly.
- **Missing upsell:** WhatsApp is Pro-only and already a tier lever; a
  point-of-sale "add done-for-you onboarding / first-campaign build for €X"
  at the moment a gym upgrades would be a clean 30-day-cash upsell.
- **The guarantee as a Money Models object:** the Pro profit-or-nothing
  guarantee is close to a **Win Your Money Back** structure (refund tied to a
  tracked outcome). It already filters for serious gyms. Worth reading the
  book's treatment of that tactic specifically before changing it.
