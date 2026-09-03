-- Booking overlap guard — close the adjacent-slot / buffer race.
--
-- 0010 added bookings_slot_idx: a unique index on (gym_id, start_at) where
-- status = 'booked'. That only stops two bookings with the *identical* start
-- time. Two concurrent bookings for different-but-overlapping times, or a
-- booking that lands inside the gap a gym keeps clear after each slot
-- (gyms.booking_buffer_minutes), both slip through the application's
-- recompute-then-insert under a true simultaneous race.
--
-- Fix: a GiST exclusion constraint that rejects any overlap of a booking's
-- time range *plus its trailing buffer*, for the same gym, among live
-- bookings. A database-level guarantee, so concurrency cannot defeat it.
--
-- Mechanics: the buffered end is materialised as a plain column
-- (guard_end_at), kept in sync by a trigger, so the exclusion expression is
-- just tstzrange(start_at, guard_end_at) over two ordinary columns. An
-- expression like end_at + make_interval(mins => buffer_minutes) cannot be
-- used directly: make_interval and interval multiplication are only STABLE,
-- and an index / exclusion expression must be IMMUTABLE.

-- btree_gist gives GiST the "=" operator for the scalar gym_id column so it
-- can sit in the same exclusion constraint as the range-overlap test.
create extension if not exists btree_gist;

alter table public.bookings
  add column if not exists buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 240);

-- The booking's time span plus its trailing buffer, [start_at, guard_end_at).
alter table public.bookings
  add column if not exists guard_end_at timestamptz;

-- Keep guard_end_at correct on every write. A trigger function has no
-- immutability requirement, unlike an index expression.
create or replace function public.bookings_set_guard_end_at()
returns trigger language plpgsql as $$
begin
  new.guard_end_at :=
    new.end_at + (new.buffer_minutes * interval '1 minute');
  return new;
end;
$$;

drop trigger if exists bookings_guard_end_at on public.bookings;

create trigger bookings_guard_end_at
  before insert or update of end_at, buffer_minutes on public.bookings
  for each row execute function public.bookings_set_guard_end_at();

-- Backfill: buffer_minutes from each gym's current setting, then guard_end_at
-- from that. Plain UPDATEs, so the STABLE interval maths is fine here.
update public.bookings b
   set buffer_minutes = g.booking_buffer_minutes
  from public.gyms g
 where g.id = b.gym_id
   and b.buffer_minutes is distinct from g.booking_buffer_minutes;

update public.bookings
   set guard_end_at = end_at + (buffer_minutes * interval '1 minute')
 where guard_end_at is null
    or guard_end_at <> end_at + (buffer_minutes * interval '1 minute');

alter table public.bookings
  alter column guard_end_at set not null;

-- The guard. tstzrange is [inclusive, exclusive), so back-to-back bookings
-- with a zero buffer (10:00-10:30 then 10:30-11:00) do NOT overlap, correct.
alter table public.bookings
  drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    gym_id with =,
    tstzrange(start_at, guard_end_at) with &&
  )
  where (status = 'booked');
