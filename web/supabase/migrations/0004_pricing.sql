-- Gym pricing: the value of a recovered booking.
--
-- casdey exists to book lapsed members back in. To say what that is worth,
-- and to check the profit-or-nothing guarantee, the product needs one number
-- from the gym: what a returning booking is typically worth to them.
--
-- Stored in minor units (pence / cents) as an integer, so there is never a
-- floating-point rounding question about money. The currency is not stored
-- here: it follows the gym's country / billing currency, decided by
-- currencyFor() in src/lib/countries.ts, exactly as the subscription price does.
--
-- Nullable on purpose: a gym that has not set it yet simply sees no
-- revenue estimate, rather than a wrong one anchored on a guessed default.

alter table public.gyms
  add column if not exists booking_value_minor integer
    check (booking_value_minor is null
           or (booking_value_minor >= 0
               and booking_value_minor <= 100000000));

comment on column public.gyms.booking_value_minor is
  'Typical value of a recovered booking, in minor units (pence/cents) of the gym''s billing currency. Powers the revenue estimate on the dashboard and the profit-or-nothing guarantee. Null until the gym sets it.';
