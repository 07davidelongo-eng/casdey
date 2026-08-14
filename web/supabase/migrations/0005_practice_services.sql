-- Practice services: the price list.
--
-- The prices a practice charges for its treatments. Two jobs, both downstream:
-- the re-engagement messages can name what a returning visit is worth, and it
-- gives the practice a place to keep its menu of services in casdey rather than
-- retyping figures into every campaign.
--
-- Prices are minor units (pence / cents), integer, same as everywhere else money
-- lives. Currency is not stored per row: it follows the practice's billing
-- currency, decided by currencyFor() in src/lib/countries.ts.

create table if not exists public.practice_services (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  practice_id  uuid not null references public.practices (id) on delete cascade,

  name         text not null,
  price_minor  integer not null
                 check (price_minor >= 0 and price_minor <= 100000000),

  -- The order the practice arranged them in. Their menu is not alphabetical.
  position     integer not null default 0
);

create index if not exists practice_services_practice_idx
  on public.practice_services (practice_id, position);

create trigger practice_services_touch
  before update on public.practice_services
  for each row execute function public.touch_updated_at();

alter table public.practice_services enable row level security;

create policy practice_services_select on public.practice_services
  for select to authenticated
  using (public.is_practice_member(practice_id));

-- Writes go through the server (service role) after an owner check, the same as
-- every other settings change, so there is no authenticated write policy.
grant select, insert, update, delete on public.practice_services to service_role;
grant select on public.practice_services to authenticated;

comment on table public.practice_services is
  'A practice''s treatment price list. Business pricing only, no patient data. Deleted with the practice.';
