-- Services stop being a price list and become the thing the gym actually
-- sells: what it costs, how often it is charged, whether it can be booked,
-- how long it runs, and how many people fit in it.
--
-- From Davide's D1 walkthrough, points #14 and #15.
--
-- #14: a price with no billing period is not a price. "€89" means one thing
-- for a monthly membership and something entirely different for a 10-class
-- pack, and casdey was treating both as one number, which makes the revenue
-- it reports meaningless the moment a gym sells both.
--
-- #15: the slot shape lived on the gym (gyms.booking_slot_minutes), so every
-- service a gym offered was the same length with the same gap after it. A gym
-- selling a 60-minute yoga class and a 30-minute PT session could describe one
-- of them correctly. Duration and buffer move onto the service; the gym-level
-- values stay as the default a service inherits when it says nothing.

alter table public.services
  add column billing_period text not null default 'one_off'
    check (billing_period in (
      'one_off', 'weekly', 'fortnightly', 'monthly',
      'quarterly', 'biannual', 'annual'
    )),
  add column description text,
  add column active boolean not null default true,
  add column bookable boolean not null default false,
  -- Null means "use the gym's default", so a gym that never thinks about this
  -- keeps one setting in one place, and a gym that does can override per
  -- service. Not defaulted to a number, because a real value here would
  -- freeze today's gym setting into every existing row.
  add column duration_minutes integer
    check (duration_minutes is null or duration_minutes between 5 and 480),
  add column buffer_minutes integer
    check (buffer_minutes is null or buffer_minutes between 0 and 240),
  -- How many members fit in one sitting. 1 is a PT slot; 20 is a class.
  add column capacity integer not null default 1
    check (capacity between 1 and 500);

comment on column public.services.billing_period is
  'How often this is charged. one_off for packs and single sessions; the rest are recurring, and drive the recurring share of recovered revenue on the dashboard.';

comment on column public.services.capacity is
  'Places in one sitting. 1 makes a booking exclusive and it blocks the gym''s diary; above 1 it is a class and members share the slot.';

comment on column public.services.duration_minutes is
  'Slot length for this service, or null to inherit gyms.booking_slot_minutes.';

-- ---------------------------------------------------------------------------
-- Bookings: a class is not a double-booking
-- ---------------------------------------------------------------------------
--
-- 0010's unique index on (gym_id, start_at) and 0015's GiST exclusion
-- constraint both encode the same assumption: the gym can only be doing one
-- thing at a time. That is right for a PT session and wrong for a class of
-- twenty, where twenty bookings share one start time by design.
--
-- So the guard becomes conditional. A booking is exclusive when its service
-- seats one person (or when no service was picked at all), and exclusive
-- bookings keep exactly the protection they have now. A shared booking is a
-- place in a class, and is protected instead by a unique seat number: seats
-- 1..capacity, one row each, so a race loses on the unique index rather than
-- overfilling the room.
--
-- The flag is denormalised onto the booking rather than joined from the
-- service, for the same reason value_minor is: an exclusion constraint cannot
-- reach into another table, and a service edited next year must not silently
-- change what a booking made today was allowed to overlap.

alter table public.bookings
  add column exclusive boolean not null default true,
  add column seat integer check (seat is null or seat between 1 and 500);

comment on column public.bookings.exclusive is
  'True when this booking occupies the gym on its own (a PT session, or no service picked). False for a place in a class. Frozen at booking time: a later change to the service must not alter what a past booking was allowed to overlap.';

comment on column public.bookings.seat is
  'Place number in a shared class, 1..capacity. Null on an exclusive booking. The unique index below is what actually enforces capacity.';

-- Only exclusive bookings hold the diary against everything else.
--
-- Two indexes had to go, not one. 0002 created appointments_slot_idx, 0011
-- renamed the table but not its indexes, and 0010 then created the same unique
-- index again under the name it expected. The live database has been carrying
-- both ever since: identical, redundant, and invisible because nothing fails
-- when two identical constraints agree. They stop agreeing the moment a class
-- is allowed to seat more than one person, and the stale one would have
-- rejected the second member of every class while the new one let them
-- through.
drop index if exists public.appointments_slot_idx;
drop index if exists public.bookings_slot_idx;

create unique index bookings_slot_idx
  on public.bookings (gym_id, start_at)
  where status = 'booked' and exclusive;

alter table public.bookings
  drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    gym_id with =,
    tstzrange(start_at, guard_end_at) with &&
  )
  where (status = 'booked' and exclusive);

-- Capacity, enforced by the database rather than by counting rows in
-- application code and hoping two people do not click at once.
create unique index bookings_class_seat_idx
  on public.bookings (gym_id, service_id, start_at, seat)
  where status = 'booked' and not exclusive;
