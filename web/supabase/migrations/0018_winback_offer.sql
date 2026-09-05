-- The win-back offer a gym has chosen, and the answers it gave to get there.
--
-- casdey sells recovered revenue and on Pro refunds itself when that revenue
-- does not appear, but a win-back message only works if there is something
-- worth coming back for. Until now the offer was left entirely to the gym, so a
-- gym that sent "we miss you, come back" recovered nobody and, on Pro, casdey
-- paid for it. This is where the offer lives so campaigns can carry it.
--
-- Stored on the gym rather than per campaign: a gym has one current offer at a
-- time, and a campaign takes a copy of the rendered text when it is created, so
-- changing the offer later never rewrites what members were already promised.

alter table public.gyms
  -- Which library entry was chosen. Kept as text rather than an enum so adding
  -- an offer to the library is a code change and not a migration.
  add column if not exists offer_id text,
  -- The member-facing text with the deadline already resolved to a real date.
  -- Denormalised on purpose: the library will change, and a member must never
  -- be shown terms that quietly differ from the ones they were sent.
  add column if not exists offer_text text,
  -- When it stops being honoured. Null for the honest check-in, which asks a
  -- question rather than making a promise and so has nothing to expire.
  add column if not exists offer_expires_at timestamptz,
  -- The answers behind the choice, so the gym can see why casdey suggested it
  -- and change one answer without starting again.
  add column if not exists offer_inputs jsonb,
  add column if not exists offer_chosen_at timestamptz;

comment on column public.gyms.offer_text is
  'Member-facing offer wording with the deadline already resolved. A campaign copies this at creation time so a later change never alters what members were already promised.';
