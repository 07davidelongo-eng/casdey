-- Feedback a gym sends casdey from inside the product (Track H1).
--
-- The whole go-to-market plan runs on feedback, and until now there was
-- nowhere in the product to give any: the support widget's only escape hatch
-- was a mailto, which opens an empty mail client and asks a gym owner to
-- compose a letter. Most of them will not.
--
-- It lands here as well as in an email so it is not lost in an inbox: an
-- inbox is a place things get read once and then buried, and this is the raw
-- material for deciding what casdey builds next.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- Attributed, not anonymous. This is B2B and the point is to start a
  -- conversation, so casdey needs to know who to reply to. Cascades with the
  -- gym: a gym that leaves takes its own words with it.
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  -- Kept as plain text rather than a foreign key to auth.users, so the record
  -- survives a staff member being removed and still says who wrote it.
  author_id   uuid,
  author_email text,
  -- Where in the product they were standing when they said it. A complaint
  -- about import is a different signal from the same words on the billing
  -- page, and asking the gym to tell us would be asking them to do our work.
  path        text,
  message     text not null check (char_length(trim(message)) between 1 and 4000)
);

create index if not exists feedback_gym_idx
  on public.feedback (gym_id, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists feedback_select on public.feedback;

-- A gym can read back what it sent us, and nothing else. Writes go through the
-- service role so the insert can happen in the same server action that emails
-- Davide, and so one gym can never write a row under another gym's id.
create policy feedback_select on public.feedback
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert on public.feedback to service_role;
grant select on public.feedback to authenticated;

comment on table public.feedback is
  'What gyms tell casdey from the in-app feedback box. Also emailed to davide@casdey.com at write time; this table is the durable copy.';
