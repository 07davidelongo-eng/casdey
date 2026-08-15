-- Self-test patient support (roadmap item #4: client self-test of the outreach).
--
-- A practice can send itself a campaign before approving it for real
-- patients. That message rides the exact same code path as a real send
-- (composeBody, the configured provider, a real unsubscribe token), which
-- means it needs a real patient row to hang off, the same way any recipient
-- does. `is_test` marks the one synthetic per-practice row that stands in for
-- the practice itself (src/lib/self-test.ts), so it is real everywhere the
-- send pipeline looks and invisible everywhere a practice looks at its own
-- numbers: dormancy stats, the patient list, campaign audiences, exports.

alter table public.patients
  add column if not exists is_test boolean not null default false;

comment on column public.patients.is_test is
  'True for the one synthetic per-practice patient used by "send yourself a test" (src/lib/self-test.ts). Excluded from dormancy stats, the patient list, campaign audiences and CSV export.';
