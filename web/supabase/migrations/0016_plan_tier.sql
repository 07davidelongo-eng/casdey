-- 3-tier pricing (Track F): Free / Standard / Pro replaces Free vs Premium.
--
-- The access STATE a gym is in (trialing / free / paying) is still derived,
-- never stored, same as lapse — see src/lib/plan.ts effectivePlan(). But once
-- there are two paid tiers, `subscription_status = 'active'` no longer says
-- WHICH tier the gym is paying for. That one fact has to be stored, because it
-- comes from the Stripe subscription's price and cannot be recomputed from the
-- gym row alone.
--
-- plan_tier is written by the Stripe webhook from the subscription's price id
-- (src/app/api/stripe/webhook), and read by effectivePlan() for any gym with a
-- live subscription. Null for a gym that has never paid (Free / trial).

alter table public.gyms
  add column if not exists plan_tier text
    check (plan_tier is null or plan_tier in ('standard', 'pro'));

comment on column public.gyms.plan_tier is
  'Which paid tier a subscribed gym is on. Set by the Stripe webhook from the subscription price; null until the first paid subscription. Trial/Free ignore it.';

-- Backfill: every gym with a live or past-due subscription today was on the
-- single "Premium" tier, which becomes Pro (the full-featured tier). A gym
-- with no live subscription keeps plan_tier null.
update public.gyms
   set plan_tier = 'pro'
 where plan_tier is null
   and subscription_status in ('active', 'past_due');
