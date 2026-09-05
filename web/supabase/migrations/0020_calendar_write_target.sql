-- Where casdey writes a booking into a gym's Google Calendar.
--
-- Found walking Track C in production on 2026-09-05: booking has never
-- written anything to Google since A6 narrowed the OAuth scope on 2026-09-03.
-- `calendar.app.created` grants access only to calendars the app creates
-- itself, so `primary` is not merely read-only under it, it is invisible:
-- events.insert on `primary` answers 404 Not Found. The mirror write is
-- best-effort by design, so it failed silently while the member was told
-- their booking was confirmed and the gym's diary never heard about it.
--
-- The fix is to write into a calendar casdey creates in the gym's own account
-- and owns. That keeps the scope non-sensitive, which is what let the OAuth
-- consent screen publish without a Google verification review, and it is
-- strictly better for the gym: casdey can only ever touch its own bookings,
-- and the gym can hide or delete the whole calendar in one action.
--
-- Reading stays on `primary`. freebusy is a separate scope and it does work
-- there (verified, 200), which is what stops casdey offering a slot the gym is
-- already busy in.

alter table public.calendar_connections
  -- The casdey-created calendar that bookings are written into. Null on a
  -- connection made before this existed, which is treated as "not provisioned
  -- yet" and filled in on next use rather than left to fail.
  add column if not exists google_write_calendar_id text;

comment on column public.calendar_connections.google_calendar_id is
  'The calendar casdey READS busy times from. Normally "primary", the gym''s own diary.';

comment on column public.calendar_connections.google_write_calendar_id is
  'The calendar casdey WRITES bookings into: a secondary calendar casdey creates in the gym''s account. Cannot be "primary": the calendar.app.created scope cannot see it.';
