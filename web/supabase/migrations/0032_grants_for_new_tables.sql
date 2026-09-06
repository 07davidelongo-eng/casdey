-- Grants that 0029 and 0031 forgot.
--
-- Both created a table, enabled row level security and added a select policy,
-- and neither granted the roles anything. RLS decides which ROWS a role may
-- see; the grant decides whether it may touch the table at all, and without it
-- Postgres refuses before a policy is ever consulted. Every other table in this
-- schema is granted in 0002, which is why nothing else showed the problem.
--
-- What it looked like from the outside: a gym's saved offers were always empty
-- and its own reasons for leaving never appeared, so two features that were
-- built and shipped looked like they had never been built at all. The reason
-- loader swallows the error by design (a campaign should still send if custom
-- reasons cannot be read), which is what kept it quiet in the logs.
--
-- select for authenticated, because both tables are read directly from server
-- components using the caller's session and RLS scopes them to the gym. Writes
-- are service_role only, matching every other table: they go through a server
-- action that has already checked the session and the owner role.

grant select on public.gym_offers to authenticated;
grant select, insert, update, delete on public.gym_offers to service_role;

grant select on public.cancellation_reasons to authenticated;
grant select, insert, update, delete on public.cancellation_reasons to service_role;
