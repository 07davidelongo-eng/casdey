-- The lapse rule stops assuming every gym thinks in months, and stops
-- forcing a visit ceiling on gyms that do not want one.
--
-- Both halves are Davide's, from the D1 walkthrough (see web/D1_WALKTHROUGH.md
-- point #11). A 12-month window suits a traditional gym; a boutique studio
-- selling 10-class packs knows a member is gone after six weeks, and had no
-- way to say so. And "came at most N times" is a real filter for some gyms and
-- an obstacle for others: a box studio wanting to write to everyone who
-- stopped, regulars included, could not switch it off.
--
-- Deliberately ADDITIVE, and lapsed_after_months stays exactly where it is.
-- Local development and production point at this same Supabase project, so a
-- migration that removed or renamed a column would break the deployed app the
-- moment it ran, before the matching code shipped. lapsed_after_days is the
-- override: null means "use the months value", which is what every existing
-- row means today and what older code still running against this schema will
-- keep reading. A later migration can drop the months column once nothing
-- reads it.

alter table public.gyms
  add column lapsed_after_days integer
    check (lapsed_after_days is null or lapsed_after_days between 7 and 1825);

comment on column public.gyms.lapsed_after_days is
  'Overrides lapsed_after_months when set: the quiet window expressed in days, for gyms whose membership cycle is shorter than a month boundary. Null means the months column is authoritative. See ruleFor() in src/lib/lapse.ts.';

-- The visit ceiling becomes optional. Null means no ceiling: a member who has
-- been in two hundred times and then stopped is still someone who stopped.
alter table public.gyms
  alter column max_visits drop not null;

comment on column public.gyms.max_visits is
  'Upper bound on visit_count for a member to count as lapsed, or null when the gym has turned the ceiling off entirely.';

-- gyms_at_risk_before_lapse guarantees the check-in window is strictly shorter
-- than the lapse window, which is what stops a member counting as both at-risk
-- and lapsed at once (see the note above atRiskRange() in src/lib/lapse.ts).
-- It only knew about the months column, so a gym setting a 30-day lapse window
-- with a 45-day check-in would have satisfied the old constraint while making
-- the two audiences overlap. Rewritten to test whichever window is actually in
-- force.
alter table public.gyms
  drop constraint gyms_at_risk_before_lapse;

alter table public.gyms
  add constraint gyms_at_risk_before_lapse
    check (
      at_risk_after_days <
        coalesce(lapsed_after_days, lapsed_after_months * 30)
    );
