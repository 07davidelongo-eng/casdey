-- Offer model: trial -> free -> premium (see src/lib/plan.ts and CLAUDE.md).
--
-- The plan itself is derived at read time from subscription_status and
-- trial_ends_at, so no plan column is added here. The one thing that must
-- persist is early-adopter eligibility: a practice that joined in the
-- V1/waitlist window keeps its lifetime upgrade discount whenever it upgrades,
-- even years later, so this cannot be recomputed from anything else.

alter table public.practices
  add column if not exists early_adopter boolean not null default false;

comment on column public.practices.early_adopter is
  'Joined during the V1/waitlist window. Grants the lifetime upgrade discount at Premium checkout, regardless of when the upgrade happens.';
