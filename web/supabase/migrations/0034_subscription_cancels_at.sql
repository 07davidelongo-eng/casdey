-- A cancelled subscription that still says "Next payment 7 Oct".
--
-- Stripe keeps a cancelled-at-period-end subscription `active` until the
-- period actually ends, which is correct: the gym paid for the month and keeps
-- it. But casdey stored only `current_period_end`, and the billing page reads
-- that as the date of the next charge. A gym that had just cancelled was told
-- it would be billed again, which is the opposite of what it had done.
--
-- Stripe already sends this on customer.subscription.updated; nothing here was
-- storing it. Null means the subscription renews as normal.
alter table public.gyms
  add column if not exists cancels_at timestamptz;

comment on column public.gyms.cancels_at is
  'When a cancelled subscription actually ends, from Stripe cancel_at. Null means it renews. While set, current_period_end is the end of access, not the date of the next charge.';
