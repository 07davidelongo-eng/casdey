-- One offer for everybody becomes one offer per reason for leaving.
--
-- From Davide's D1 walkthrough, point #18. The offer builder produced a single
-- line of text sent to every lapsed member, which quietly assumes they all
-- left for the same reason. They did not: somebody who left because it was
-- expensive and somebody who left because they were injured need opposite
-- things said to them, and sending both the same discount wastes margin on one
-- and insults the other.
--
-- Stored as jsonb on the gym rather than as a table. The set of reasons is
-- closed and small (six, mirroring members.cancellation_reason), every read
-- that needs an offer already has the gym row in hand, and a table would add a
-- join, an RLS policy and a migration to every future reason for no gain. The
-- shape is:
--
--   { "price": { "text": "...", "expiresAt": "2026-10-01T...", "offerId": "..." }, ... }
--
-- gyms.offer_text stays exactly as it is and remains the default: a member
-- with no recorded reason, or a reason the gym has not written a variant for,
-- gets it. That is the common case and it must keep working untouched.

alter table public.gyms
  add column offer_variants jsonb not null default '{}'::jsonb;

comment on column public.gyms.offer_variants is
  'Per-reason win-back offers, keyed by members.cancellation_reason. Falls back to gyms.offer_text when a member has no reason on file or the gym wrote no variant for theirs. See offerForMember() in src/lib/offers/variants.ts.';
