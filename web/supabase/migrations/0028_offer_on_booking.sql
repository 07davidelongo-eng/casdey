-- Making an offer something a gym can actually honour (D1 walkthrough #39).
--
-- An offer used to be a sentence inside a message and nothing else. The member
-- read it, walked in, and the person at the desk had no way to tell a genuine
-- casdey offer from someone chancing it, no way to know which offer had been
-- promised, and no record afterwards that it had been used.
--
-- The code itself is derived from the member's booking token rather than
-- stored (see src/lib/offer-code.ts), so there is no column for it on members
-- and nothing to keep in step. What does need storing is what was promised at
-- the moment of booking: the gym's offer wording can change tomorrow, and a
-- booking has to keep saying what it said today. Same reasoning as
-- bookings.value_minor in 0027, which freezes the price for the same reason.
--
-- Additive only. Local development and production share this database.

alter table public.bookings
  add column if not exists offer_code text,
  add column if not exists offer_text text;

comment on column public.bookings.offer_code is
  'The code the member quoted, derived from their booking token at the time. '
  'Stored so the booking is a record even if the token were ever rotated.';

comment on column public.bookings.offer_text is
  'The offer wording as the member was actually shown it. Frozen: editing the '
  'gym''s offer later must never rewrite what somebody was already promised.';

-- The gym looks a booking up by the code a member reads out at the desk, so
-- that lookup has to be an index rather than a scan of every booking it has
-- ever taken.
create index if not exists bookings_offer_code_idx
  on public.bookings (gym_id, offer_code)
  where offer_code is not null;
