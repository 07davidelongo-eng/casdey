-- Follow-ups: a campaign stops being one message and becomes a sequence.
--
-- From Davide's D1 walkthrough, point #8. The product's own promise is that
-- casdey behaves like a member of staff who chases the people who stopped
-- coming, and a member of staff does not write once and give up. casdey's own
-- cold outreach has run two follow-ups since 2026-09-02 for exactly this
-- reason; the product it sells did not.
--
-- Shape: campaigns.follow_ups is an ordered array of
--   [{ "afterDays": 4, "subject": "...", "body": "..." }, ...]
-- where entry N is the follow-up sent after step N. It is a jsonb array rather
-- than two more subject/body column pairs because the number of follow-ups is
-- a product decision that will move, and widening an array is not a migration.
--
-- A follow-up row is created when the step before it actually SENDS, never up
-- front. Queueing the whole sequence at build time would mean cancelling rows
-- for every member who books, replies, or unsubscribes in between, and every
-- one of those cancellations is a chance to email somebody who already came
-- back. Scheduling forward one step at a time means the question "should this
-- person still hear from us" is asked at the last possible moment.

alter table public.campaign_messages
  add column step smallint not null default 1
    check (step between 1 and 4);

comment on column public.campaign_messages.step is
  'Position in the campaign sequence. 1 is the first message; 2 and up are follow-ups, created only once the previous step has been sent. See drainQueue() in src/lib/sender.ts.';

-- One message per member per campaign becomes one per member per campaign per
-- step. The old constraint is what made a sequence impossible.
--
-- On the live database it is still called ..._campaign_id_patient_id_key: the
-- dental-to-gym rename in 0011 renamed columns, and a constraint name is just
-- a name, so it kept the one it was born with. Dropped by whichever name it
-- actually has rather than by the one it ought to have.
do $$
declare
  old_name text;
begin
  select conname into old_name
  from pg_constraint
  where conrelid = 'public.campaign_messages'::regclass
    and contype = 'u'
    and conname in (
      'campaign_messages_campaign_id_member_id_key',
      'campaign_messages_campaign_id_patient_id_key'
    );

  if old_name is not null then
    execute format(
      'alter table public.campaign_messages drop constraint %I', old_name
    );
  end if;
end $$;

alter table public.campaign_messages
  add constraint campaign_messages_one_per_step
    unique (campaign_id, member_id, step);

alter table public.campaigns
  add column follow_ups jsonb not null default '[]'::jsonb;

comment on column public.campaigns.follow_ups is
  'Ordered follow-up steps: [{afterDays, subject, body}]. Empty array means the campaign is a single message. Entry N follows step N.';

-- 'cancelled' already exists in the status check; this is the first thing that
-- actually uses it. A follow-up to somebody who booked in the meantime is
-- cancelled rather than suppressed, because suppressed means "we must never
-- write to this address" and this is the opposite: it worked.
comment on table public.campaign_messages is
  'One queued or sent message per member per campaign step. Holds a member email address: same handling rules as public.members.';
