-- Every reason belongs to the gym, casdey's six included (#46).
--
-- 0031 kept the six built-in reasons in code and let a gym add its own on top.
-- That protected the keys already recorded against members, and it meant the
-- six could not be renamed or removed, which is precisely what Davide asked
-- for and did not get.
--
-- So they become rows. Seeded once per gym, then owned by that gym: rename
-- them, delete them, add more. The keys are unchanged, so every member already
-- tagged 'price' still reads as whatever the gym now calls that row, and a
-- member tagged with a row the gym has since deleted keeps the tag and falls
-- back to casdey's general wording rather than losing their history.
--
-- The marker column is what stops a gym that deliberately deleted every reason
-- from having all six put back on the next page load. Seeded once means once.
--
-- Additive only. Local development and production share this database.

alter table public.gyms
  add column if not exists reasons_initialised_at timestamptz;

comment on column public.gyms.reasons_initialised_at is
  'When casdey seeded this gym''s cancellation_reasons with the six defaults. '
  'Set once. A gym that deletes them all keeps them deleted.';
