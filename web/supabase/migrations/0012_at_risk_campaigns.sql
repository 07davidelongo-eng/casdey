-- At-risk detection + campaign kind.
--
-- "Lapsed" (lapse.ts) is a member who already crossed the gym's own
-- no-visit window. At-risk is the same recency signal, applied earlier and
-- only to members nobody has touched yet, so a gym can check in before
-- someone becomes a win-back case instead of only after. The window is
-- configurable per gym, same as lapsed_after_months/max_visits, and
-- constrained to sit strictly inside the lapse window so the two ranges
-- never overlap (enforced below, not just assumed in application code).

alter table public.gyms
  add column at_risk_after_days integer not null default 45
    check (at_risk_after_days between 7 and 180);

alter table public.gyms
  add constraint gyms_at_risk_before_lapse
    check (at_risk_after_days < lapsed_after_months * 30);

-- Every campaign has been the same shape (win-back only) until now. Existing
-- rows default to 'win_back' so nothing already sent is reclassified.
alter table public.campaigns
  add column kind text not null default 'win_back'
    check (kind in ('win_back', 'at_risk'));

comment on column public.gyms.at_risk_after_days is
  'Days of no visit before a still-active member counts as at-risk. Must stay shorter than the lapse window (see gyms_at_risk_before_lapse).';

comment on column public.campaigns.kind is
  'win_back: audience is lapsed/cancelled members. at_risk: audience is still-active members trending toward lapse.';
