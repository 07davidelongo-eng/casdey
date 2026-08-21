-- Gym services: the price list.
--
-- The prices a gym charges for its memberships, classes and sessions. Two jobs, both downstream:
-- the re-engagement messages can name what a returning visit is worth, and it
-- gives the gym a place to keep its menu of services in casdey rather than
-- retyping figures into every campaign.
--
-- Prices are minor units (pence / cents), integer, same as everywhere else money
-- lives. Currency is not stored per row: it follows the gym's billing
-- currency, decided by currencyFor() in src/lib/countries.ts.

create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  gym_id  uuid not null references public.gyms (id) on delete cascade,

  name         text not null,
  price_minor  integer not null
                 check (price_minor >= 0 and price_minor <= 100000000),

  -- The order the gym arranged them in. Their menu is not alphabetical.
  position     integer not null default 0
);

create index if not exists services_gym_idx
  on public.services (gym_id, position);

create trigger services_touch
  before update on public.services
  for each row execute function public.touch_updated_at();

alter table public.services enable row level security;

create policy services_select on public.services
  for select to authenticated
  using (public.is_gym_user(gym_id));

-- Writes go through the server (service role) after an owner check, the same as
-- every other settings change, so there is no authenticated write policy.
grant select, insert, update, delete on public.services to service_role;
grant select on public.services to authenticated;

comment on table public.services is
  'A gym''s price list. Business pricing only, no member data. Deleted with the gym.';
