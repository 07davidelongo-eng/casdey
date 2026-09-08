-- A gym created for casdey's own development/QA rather than a real customer
-- (#stress-testing, feature verification, Davide's own accounts). Mirrors
-- members.is_test, which already exists for exactly this reason at the member
-- level: a real number (MRR, paying-gym count, signup trend) must never
-- silently include a fixture nobody actually pays casdey for.
--
-- Found 2026-09-08: the founder-facing /admin dashboard (src/lib/admin-stats.ts)
-- had no way to exclude these, so every internal test/dev gym with an
-- open Stripe test-mode subscription (or, in one case, Davide's own real
-- live-mode card during the 2026-09-07 V1 walkthrough) was counted as a
-- paying customer. Default false: every gym created from here on is real
-- unless explicitly marked otherwise.
--
-- Additive only. Local development and production share this database.

alter table public.gyms
  add column if not exists is_internal boolean not null default false;

comment on column public.gyms.is_internal is
  'True for a gym created by casdey itself for development or QA, never a real customer. Excluded from every founder-facing count in admin-stats.ts.';

-- The four rows already known to be internal, all created during feature
-- verification rather than by a real gym owner. See CLAUDE.md's dated build
-- history for what each one tested.
update public.gyms
set is_internal = true
where id in (
  '535c7ffe-a10f-463e-bf28-7c955acfa744', -- Test Admin: Davide's own account, 2026-09-07 V1 walkthrough (C1)
  '37a697fb-281e-4d17-b5d6-db3588226965', -- Riverside Fitness: 2026-08-15 guarantee stress test
  '4540649f-d38c-442f-8162-44d6abb51113', -- Stress Test Fitness Studio: 2026-08-15/16 stress-test audit
  '110934f8-ab1c-4326-bd6f-0d876fd38bd5'  -- casdey Sending Test: 2026-09-04 per-gym sending identity work
);

-- One-time backfill, not a code fix: the webhook did not write cancels_at at
-- all before commit ada416d (2026-09-07 20:31:52 UTC), and the Test Admin
-- gym's subscription was cancelled fourteen minutes before that, at 20:17:50.
-- The code has been correct for every event since; this row was simply
-- never re-synced because nothing has changed on that subscription since.
-- Value confirmed directly against the live Stripe subscription
-- (sub_1UD8eTDGwemFDmSPp09mzHJH: cancel_at = 2026-10-07T19:56:09Z).
update public.gyms
set cancels_at = '2026-10-07T19:56:09Z'
where id = '535c7ffe-a10f-463e-bf28-7c955acfa744'
  and cancels_at is null;
