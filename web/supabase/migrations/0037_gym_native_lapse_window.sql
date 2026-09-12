-- The lapse window stops being a dental recall cycle.
--
-- gyms.lapsed_after_months has defaulted to 12 since 0002_saas.sql, where the
-- comment beside it reads "came once or twice, no visit in a year". That was
-- written for dental practices, whose recall genuinely is annual, and it
-- survived the whole pivot to gyms untouched.
--
-- For a gym it is wrong, and wrong in the most expensive place. A new gym
-- imports its list and casdey flags only the members who have not been in for
-- a full year, so the very first screen it ever sees is a near-empty lapsed
-- list and a near-zero opportunity figure. The one thing casdey has to do in
-- that first minute is show the owner money they did not know was sitting
-- there, and the default guaranteed it showed them almost nothing. For a
-- CrossFit box or a boutique studio a member gone eight to twelve weeks is
-- lapsed; a year is someone who has moved city.
--
-- 90 days is the new default. It sits inside the window the reactivation
-- research actually measures (10-20% recovery at 30-90 days, 5-10% at
-- 90-180), and it is short enough that a real list produces a real number on
-- day one. Every gym can still change it, and now it is asked to.
--
-- Both columns move together. lapsed_after_days is what ruleFor() reads when
-- it is set (src/lib/lapse.ts), and lapsed_after_months is kept in step
-- behind it because the deployed app shares this database and older code
-- still reads the months column. 3 is ceil(90/30), matching the round-UP
-- rule in saveSettingsAction: a stale reader then has a window no shorter
-- than the gym asked for, so it under-contacts rather than over-contacts.

alter table public.gyms
  alter column lapsed_after_days set default 90;

alter table public.gyms
  alter column lapsed_after_months set default 3;

comment on column public.gyms.lapsed_after_months is
  'Legacy quiet window in months, overridden by lapsed_after_days whenever that is set. Defaults to 3 to stay consistent with the 90-day default on lapsed_after_days. See ruleFor() in src/lib/lapse.ts.';

-- Whether the gym has ever actually decided this, as opposed to inheriting
-- whatever casdey shipped. Null means never chosen.
--
-- Without this the product cannot tell the two apart, and the first-run
-- checklist had to treat "has members" as proof the rule was reviewed (see
-- the comment it replaces in src/lib/setup.ts). That is exactly the assumption
-- that let BodyActive sit on a dental default: the step read as done because
-- a list existed, while nobody had looked at the window at all.
alter table public.gyms
  add column lapse_rule_set_at timestamptz;

comment on column public.gyms.lapse_rule_set_at is
  'When the gym last deliberately saved its lapse rule. Null means it has never chosen and is still on casdey''s default, which the first-run checklist asks it to confirm.';

-- Existing gyms, carefully.
--
-- Only rows that never overrode the months column AND hold no members at all.
-- A gym with members has already seen counts computed under its current
-- window, and silently redefining "lapsed" underneath it would move every
-- number on its dashboard with no explanation. Those rows keep what they
-- have; the checklist now asks them to choose, which is the honest way to
-- change it.
--
-- lapse_rule_set_at is deliberately left null here. This is casdey correcting
-- its own default, not the gym making a decision, so the gym is still asked.
--
-- The at_risk_after_days guard matters: gyms_at_risk_before_lapse requires
-- at_risk_after_days < coalesce(lapsed_after_days, lapsed_after_months * 30),
-- and a gym with a check-in window of 90 days or more would fail it the
-- moment the lapse window became 90. Every row is on the default 45 today, so
-- this excludes nothing now, and it stops the migration exploding if it is
-- ever replayed against a database where that is no longer true.
update public.gyms g
   set lapsed_after_days = 90,
       lapsed_after_months = 3
 where g.lapsed_after_days is null
   and g.at_risk_after_days < 90
   and not exists (
     select 1 from public.members m where m.gym_id = g.id
   );
