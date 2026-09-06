-- A gym's own reasons for members leaving (D1 walkthrough #33).
--
-- The six built-in reasons are a good guess at what a gym hears at the front
-- desk, and a guess is all they are. A creche closing, a shift pattern
-- changing, a competitor opening across the road: these are the reasons a
-- particular gym actually loses people for, and "Something else" collapses all
-- of them into one bucket that no offer can answer.
--
-- The six stay, as defaults, in code (src/lib/cancellation.ts). This table is
-- only what a gym adds on top, which means no data migration and no risk to the
-- rows already recorded against the built-in keys.
--
-- The check constraint on members.cancellation_reason has to go, because it
-- enumerated those six. It is replaced by a shape constraint rather than
-- removed entirely: a reason is still a short lowercase slug and not free text,
-- so a typo cannot quietly create a seventh category nobody meant.
--
-- Additive except for that constraint swap. Local development and production
-- share this database.

create table if not exists public.cancellation_reasons (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  -- The slug stored on members.cancellation_reason.
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,38}$'),
  -- What staff see in the picker.
  label text not null check (length(label) between 1 and 60),
  -- How it reads back to the member inside {{reason}}, e.g. "the childcare".
  -- Written by the gym, because only they know how to say their own reason
  -- gently to the person who gave it.
  phrase text not null check (length(phrase) between 1 and 80),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (gym_id, key)
);

create index if not exists cancellation_reasons_gym_idx
  on public.cancellation_reasons (gym_id, position);

alter table public.cancellation_reasons enable row level security;

drop policy if exists cancellation_reasons_select on public.cancellation_reasons;
create policy cancellation_reasons_select on public.cancellation_reasons
  for select
  using (public.is_gym_user(gym_id));

-- Swap the enumerated constraint for a shape one.
do $$
declare
  con text;
begin
  select conname into con
  from pg_constraint
  where conrelid = 'public.members'::regclass
    and pg_get_constraintdef(oid) ilike '%cancellation_reason%'
    and contype = 'c'
  limit 1;

  if con is not null then
    execute format('alter table public.members drop constraint %I', con);
  end if;
end $$;

alter table public.members
  add constraint members_cancellation_reason_shape
  check (
    cancellation_reason is null
    or cancellation_reason ~ '^[a-z][a-z0-9_]{1,38}$'
  );

comment on table public.cancellation_reasons is
  'Reasons a gym added itself, on top of the six built into casdey. The '
  'built-ins are not rows here: they live in src/lib/cancellation.ts.';
