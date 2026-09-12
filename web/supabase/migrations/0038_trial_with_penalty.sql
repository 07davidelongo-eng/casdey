-- Trial With Penalty.
--
-- Track H of web/SAAS_V1_1_PLAN.md, decided by Davide on 2026-09-10, and it
-- reverses the settled "no card taken" call from 2026-08-14. The reason is in
-- the plan and in the Hormozi ledger: a free trial with no card and no
-- required actions is the version people do not use, do not get value from,
-- and do not convert from. casdey has exactly one data point and it is that
-- shape. BodyActive signed up, signed in once, imported nothing, and its free
-- week was going to expire having shown it nothing at all.
--
-- The mechanism: €1 at signup with the card saved, an affirmative commitment,
-- and three activation steps. At day 7 a gym that did the three converts to
-- Pro; a gym that cancelled owes nothing; a gym that ghosted is charged €20
-- per unfinished step, capped at €60, and drops to Free.
--
-- The fee is not revenue and is not meant to be collected. It exists to move
-- one number, the share of trials that get set up, and if every gym activates
-- and no fee ever fires then it worked perfectly. Hence the waiver and the
-- automatic make-good refund below.
--
-- Everything here is additive and inert until CASDEY_TRIAL_PENALTY is on, so
-- applying it changes nothing about how signup behaves today.

-- --------------------------------------------------------------------------
-- The trial's own state, on the gym.
-- --------------------------------------------------------------------------

alter table public.gyms
  -- The €1 has been charged and a reusable card is on file. Until this is
  -- set there is nothing to charge later, so nothing downstream may assume
  -- a payment method exists.
  add column trial_card_setup_at timestamptz,
  -- Stripe's id for the saved card. The €1 PaymentIntent is also what saves
  -- it (setup_future_usage), so one step does both jobs. Kept here as well as
  -- on the Stripe customer because the day-7 charge should not depend on the
  -- customer's default payment method having been set correctly.
  add column trial_payment_method_id text,
  -- The gym answered "yes, if casdey brings members back I will stay on".
  -- Hormozi's affirmative commitment: the ask is the point, not the answer.
  add column trial_commitment_at timestamptz,
  -- The gym opted out during the week. A cancelled trial owes NO setup fee,
  -- even with every step unfinished: the fee is aimed at the gym that took a
  -- free week and sat on it, not at one that actively declined.
  add column trial_cancelled_at timestamptz,
  -- The day-7 job turned this trial into a paid Pro subscription.
  add column trial_converted_at timestamptz,
  -- The day-7 job has finished with this trial, whatever the outcome. This is
  -- the idempotency guard and it is not the same as any of the three above:
  -- the ghost outcome (fees charged, dropped to Free) sets only this one, and
  -- without it a second run of the job would bill the fees again.
  add column trial_closed_at timestamptz,
  -- The last nudge day sent (2, 5 or 6). The nudges only ever go forward, so
  -- one number is enough to stop a re-run repeating one.
  add column trial_last_nudge_day smallint;

comment on column public.gyms.trial_card_setup_at is
  'When the €1 trial charge succeeded and a reusable card was saved. Null means no payment method: the day-7 job can neither convert nor charge a fee.';
comment on column public.gyms.trial_cancelled_at is
  'When the gym opted out during its free week. A cancelled trial never owes a setup fee, however little was set up.';
comment on column public.gyms.trial_closed_at is
  'When the day-7 job finished with this trial, whatever the outcome. The idempotency guard: a trial with this set is never processed again.';

-- --------------------------------------------------------------------------
-- The three activation steps, timestamped.
-- --------------------------------------------------------------------------
--
-- These are the actions that both activate the gym and produce the evidence
-- the profit-or-nothing guarantee is later judged on: a member list, prices
-- to value a recovered booking at, and a campaign actually approved to send.
--
-- Timestamps rather than booleans, because two things need to know WHEN.
-- The day-7 job needs "was this done before the deadline", and the make-good
-- refund needs "was this done within 7 days of being billed for it".
--
-- They are written at the three action sites, and read defensively: a step
-- also counts as done if the thing it asks for exists, so a missed stamp can
-- never be the reason a gym gets charged. See activationFor() in
-- src/lib/trial.ts. Conservative in the one direction that matters.
alter table public.gyms
  add column activated_import_at timestamptz,
  add column activated_prices_at timestamptz,
  add column activated_campaign_at timestamptz;

comment on column public.gyms.activated_import_at is
  'When this gym first imported members. Read alongside the live member count, never instead of it: a missing stamp must not cost a gym €20.';

-- --------------------------------------------------------------------------
-- The fees themselves.
-- --------------------------------------------------------------------------

create table public.trial_penalties (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,

  -- Which unfinished step this fee is for. Per-step rather than one lump sum,
  -- following $100M Money Models pg 124: "I'd rather bill $50 for each mess up
  -- than one $500 fee on their first mess up". It applies here because the
  -- three steps are sequential and none is individually catastrophic to miss.
  step          text not null
                  check (step in ('import', 'prices', 'campaign')),

  amount_minor  integer not null check (amount_minor > 0),
  currency      text not null check (currency in ('eur', 'gbp')),

  -- Set when Stripe took the money. Null with failure_reason set means the
  -- charge was attempted and declined, which is not worth chasing: the fee is
  -- a nudge, not income.
  stripe_payment_intent_id text,
  charged_at    timestamptz,
  failure_reason text,

  -- Refunds, of which there are two kinds and both are part of the design.
  -- A waiver is Davide deciding not to charge somebody (MM pg 128: "A small
  -- fee isn't worth a 1-star review"). A make-good is automatic: finish the
  -- step within 7 days of being billed and that step's fee comes back.
  refunded_at   timestamptz,
  refund_reason text check (refund_reason in ('waived', 'made_good')),

  created_at    timestamptz not null default now(),

  -- A step can be billed at most once, ever. The day-7 job is idempotent by
  -- trial_closed_at, and this is the belt to that braces.
  unique (gym_id, step)
);

create index trial_penalties_gym_idx on public.trial_penalties(gym_id);
-- The make-good sweep looks for charged, not-yet-refunded fees.
create index trial_penalties_open_idx on public.trial_penalties(charged_at)
  where refunded_at is null;

alter table public.trial_penalties enable row level security;

-- A gym may read its own fees, and that is all. Charging, refunding and
-- waiving are all server-side (the cron job and /admin), which run as the
-- service role and bypass RLS.
create policy trial_penalties_read on public.trial_penalties
  for select using (public.is_gym_user(gym_id));

-- Grants, deliberately explicit.
--
-- 0029 and 0031 both created tables with RLS on and no grants, which made two
-- shipped features look unbuilt until 0032 went back and fixed them: RLS
-- decides WHICH rows a role may see, and a grant decides whether it may reach
-- the table at all. Missing the grant fails as "relation does not exist"
-- rather than as an empty result, which is why it reads as broken code.
grant select on public.trial_penalties to authenticated;
grant select, insert, update, delete on public.trial_penalties to service_role;

comment on table public.trial_penalties is
  'Setup fees for trial steps a gym never finished. Not revenue: the mechanism exists to raise activation, and a fee that never fires is the success case. Waivable from /admin and auto-refunded when the step is completed within 7 days.';
