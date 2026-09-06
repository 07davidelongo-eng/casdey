-- Prices that are not charged on one of seven fixed rhythms (#24).
--
-- billing_period covered weekly through annual, which covers most gyms and
-- not all of them. A studio billing a block every five months, or a box
-- selling a three-week intro, had nothing honest to pick, and picking the
-- nearest wrong one quietly corrupts every recurring-revenue figure built on
-- top of it.
--
-- The fix is a count beside the unit rather than a longer list of units:
-- billing_period says what the rhythm is measured in, billing_interval says
-- how many of them. monthly + 5 is every five months. The default of 1 means
-- every existing row keeps exactly the meaning it already had.
--
-- Additive only. Local development and production share this database.

alter table public.services
  add column if not exists billing_interval integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_billing_interval_check'
  ) then
    alter table public.services
      add constraint services_billing_interval_check
      check (billing_interval between 1 and 52);
  end if;
end $$;

comment on column public.services.billing_interval is
  'How many billing_periods between charges. 1 is every period, 5 with '
  'billing_period=monthly is every five months. Always 1 for one_off.';
