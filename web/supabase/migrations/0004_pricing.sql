-- Practice pricing: the value of a recovered appointment.
--
-- casdey exists to book dormant patients back in. To say what that is worth,
-- and to check the profit-or-nothing guarantee, the product needs one number
-- from the practice: what a returning appointment is typically worth to them.
--
-- Stored in minor units (pence / cents) as an integer, so there is never a
-- floating-point rounding question about money. The currency is not stored
-- here: it follows the practice's country / billing currency, decided by
-- currencyFor() in src/lib/countries.ts, exactly as the subscription price does.
--
-- Nullable on purpose: a practice that has not set it yet simply sees no
-- revenue estimate, rather than a wrong one anchored on a guessed default.

alter table public.practices
  add column if not exists appointment_value_minor integer
    check (appointment_value_minor is null
           or (appointment_value_minor >= 0
               and appointment_value_minor <= 100000000));

comment on column public.practices.appointment_value_minor is
  'Typical value of a recovered appointment, in minor units (pence/cents) of the practice''s billing currency. Powers the revenue estimate on the dashboard and the profit-or-nothing guarantee. Null until the practice sets it.';
