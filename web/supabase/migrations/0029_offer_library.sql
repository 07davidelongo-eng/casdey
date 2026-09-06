-- A gym's own offers, kept rather than overwritten (D1 walkthrough #26).
--
-- The offer model held exactly one general offer on the gym row plus one
-- freeform variant per reason for leaving. That is enough to send with and not
-- enough to work with: choosing a new offer silently destroyed the old one, so
-- a gym that wanted to try a different angle in January and go back in March
-- had to remember the January wording itself, and there was no way to write an
-- offer now and use it later.
--
-- This table is the gym's library. gyms.offer_text stays exactly as it is and
-- remains what a campaign reads, so nothing about sending changes: the library
-- is where offers live, and the gym row is which one is currently in use.
--
-- Additive only. Local development and production share this database.

create table if not exists public.gym_offers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  -- What the gym calls it. Never shown to a member.
  name text not null,
  -- What the member reads, deadline already resolved to a real date.
  body text not null,
  expires_at date,
  -- Which library offer it started from (src/lib/offers/library.ts), or null
  -- when the gym wrote it themselves. Text, not a foreign key: the library is
  -- code, and an offer the gym has saved must survive that code being edited.
  library_id text,
  created_at timestamptz not null default now()
);

create index if not exists gym_offers_gym_idx
  on public.gym_offers (gym_id, created_at desc);

alter table public.gym_offers enable row level security;

-- Same shape as every other gym-owned table: staff read their own gym's rows,
-- and every write goes through the service role in a server action that has
-- already checked the session.
drop policy if exists gym_offers_select on public.gym_offers;
create policy gym_offers_select on public.gym_offers
  for select
  using (public.is_gym_user(gym_id));

comment on table public.gym_offers is
  'A gym''s saved win-back offers. gyms.offer_text is whichever one is '
  'currently in use; this is everything they have written.';
