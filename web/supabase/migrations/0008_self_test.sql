-- Self-test member support (roadmap item #4: client self-test of the outreach).
--
-- A gym can send itself a campaign before approving it for real
-- members. That message rides the exact same code path as a real send
-- (composeBody, the configured provider, a real unsubscribe token), which
-- means it needs a real member row to hang off, the same way any recipient
-- does. `is_test` marks the one synthetic per-gym row that stands in for
-- the gym itself (src/lib/self-test.ts), so it is real everywhere the
-- send pipeline looks and invisible everywhere a gym looks at its own
-- numbers: lapse stats, the member list, campaign audiences, exports.

alter table public.members
  add column if not exists is_test boolean not null default false;

comment on column public.members.is_test is
  'True for the one synthetic per-gym member used by "send yourself a test" (src/lib/self-test.ts). Excluded from lapse stats, the member list, campaign audiences and CSV export.';
