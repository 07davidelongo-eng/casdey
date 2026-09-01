-- Cancellation reason capture, and a live bug fix riding along with it.
--
-- A member who tells the gym they are cancelling is a cleaner, more
-- immediate win-back signal than waiting for last_visit_at to naturally
-- cross the lapse cutoff, which can be most of a year away. This is metadata
-- alongside the existing status lifecycle, not a new status value: it does
-- not change what "active/contacted/returned/opted_out" means anywhere else
-- in the app, it only widens who buildAudience() considers (see
-- src/lib/campaigns.ts).

alter table public.members
  add column cancellation_reason text
    check (cancellation_reason is null or cancellation_reason in
      ('price', 'relocation', 'dissatisfaction', 'health', 'no_time', 'other')),
  add column cancelled_at timestamptz;

comment on column public.members.cancellation_reason is
  'Set by staff when a member formally cancels. Orthogonal to status: does not itself change active/contacted/returned/opted_out.';

-- Bug fix found while building the above: web/src/app/app/members/[id]/actions.ts
-- unmarkReturnedAction (added in 628f556) inserts a member_events row with
-- type 'return_undone', but that value was never added to this check
-- constraint, so the insert has been silently failing in production (its
-- error is not checked). The member status update itself still succeeds;
-- only the timeline event was missing. Fixed here alongside adding
-- 'cancelled' for the new mark-as-cancelled action, since both need the
-- same alter.
alter table public.member_events
  drop constraint member_events_type_check;

alter table public.member_events
  add constraint member_events_type_check
  check (type in (
    'imported', 'message_sent', 'message_failed', 'replied',
    'returned', 'return_undone', 'booked', 'opted_out', 'cancelled'
  ));
