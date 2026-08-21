-- casdey SaaS schema
--
-- Run this in the Supabase SQL editor against the same EU-region project that
-- holds `waitlist_signups`. Everything below is multi-tenant: a gym is the
-- tenant, and a user reaches data only through a row in `gym_users`.
--
-- Two rules repeat in every table here, both learned the hard way (see
-- web/README.md):
--
--   1. Row level security is on, and the policies are membership-based. The
--      anon role can do nothing anywhere.
--   2. `service_role` bypasses RLS but does NOT bypass table grants, which are
--      a separate permission layer. Without an explicit grant, inserts fail
--      with "42501 permission denied for table" before RLS is ever evaluated.
--      `authenticated` needs its grants spelled out for the same reason.
--
-- `members` holds health-adjacent personal data. The gym is the data
-- controller, casdey is the processor. Retention is recorded in the table
-- comments and enforced by the cleanup in 0003 (see settings/data in the app
-- for the manual erasure path).

-- The RLS helper functions below select from tables created later in this
-- file. Postgres validates function bodies at creation time by default and
-- would reject the forward reference. Turning the check off for this script
-- lets it read top to bottom; the functions are only ever CALLED after the
-- tables exist, so runtime behaviour is unchanged. Session-scoped, so it
-- reverts on its own.
set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Keeps `updated_at` honest without the application having to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Membership test used by every RLS policy below.
--
-- SECURITY DEFINER matters: a policy on `gym_users` that itself selects
-- from `gym_users` recurses forever. Running the lookup as the definer
-- skips RLS for this one narrow question and breaks the cycle. `search_path` is
-- pinned so the function cannot be redirected at a shadowed table.
create or replace function public.is_gym_user(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_users m
    where m.gym_id = p_gym_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_gym_owner(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_users m
    where m.gym_id = p_gym_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

grant usage on schema public to service_role, authenticated;
grant execute on function public.is_gym_user(uuid) to authenticated, service_role;
grant execute on function public.is_gym_owner(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------

-- Creates a gym and its owner membership in one transaction.
--
-- Doing this as two separate inserts from the application means a failure
-- between them leaves a gym nobody is a member of, which no policy in this
-- schema can ever reach again. Defined further down, after the tables exist.

-- ---------------------------------------------------------------------------
-- gyms — the tenant root
-- ---------------------------------------------------------------------------

create table if not exists public.gyms (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  name                  text not null,
  country               text not null default 'GB',
  timezone              text not null default 'Europe/London',
  contact_email         text not null,

  -- How members see the re-engagement email. reply_to_email is where a "yes,
  -- book me in" actually lands, so it is the gym's own inbox.
  sender_name           text,
  reply_to_email        text,

  -- What "lapsed" means for this gym. Defaults match the product
  -- promise: came once or twice, no visit in a year.
  lapsed_after_months  integer not null default 12
                          check (lapsed_after_months between 3 and 60),
  max_visits            integer not null default 2
                          check (max_visits between 1 and 20),
  daily_send_cap        integer not null default 50
                          check (daily_send_cap between 1 and 1000),

  -- Billing. plan_currency is decided by country at checkout: GB pays in GBP,
  -- everyone else in EUR.
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  subscription_status   text not null default 'none'
                          check (subscription_status in
                            ('none','trialing','active','past_due','canceled','incomplete')),
  plan_currency         text check (plan_currency in ('gbp','eur')),
  plan_interval         text check (plan_interval in ('month','year')),
  trial_ends_at         timestamptz,
  current_period_end    timestamptz,

  -- The gym confirming it is the controller and has a lawful basis to
  -- contact these members. Import is blocked until this is set.
  processing_agreed_at  timestamptz,
  processing_agreed_by  uuid references auth.users (id) on delete set null,

  onboarded_at          timestamptz
);

create trigger gyms_touch
  before update on public.gyms
  for each row execute function public.touch_updated_at();

alter table public.gyms enable row level security;

create policy gyms_select on public.gyms
  for select to authenticated
  using (public.is_gym_user(id));

create policy gyms_update on public.gyms
  for update to authenticated
  using (public.is_gym_owner(id))
  with check (public.is_gym_owner(id));

-- No insert policy on purpose. A gym is created server-side during
-- onboarding, together with its owner membership row, so the two can never
-- come apart and leave an orphan tenant nobody can reach.

grant select, insert, update, delete on public.gyms to service_role;
grant select, update on public.gyms to authenticated;

comment on table public.gyms is
  'One gym, the tenant boundary for everything else. Business contact details only, no member data.';

-- ---------------------------------------------------------------------------
-- gym_users — who can see a gym
-- ---------------------------------------------------------------------------

create table if not exists public.gym_users (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  gym_id  uuid not null references public.gyms (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner','staff')),
  unique (gym_id, user_id)
);

create index if not exists gym_users_user_idx
  on public.gym_users (user_id);

alter table public.gym_users enable row level security;

create policy gym_users_select on public.gym_users
  for select to authenticated
  using (user_id = auth.uid() or public.is_gym_user(gym_id));

grant select, insert, update, delete on public.gym_users to service_role;
grant select on public.gym_users to authenticated;

comment on table public.gym_users is
  'Links a Supabase auth user to a gym. Every RLS policy in this schema resolves through this table.';

-- ---------------------------------------------------------------------------
-- imports — one row per import run
-- ---------------------------------------------------------------------------

create table if not exists public.imports (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  gym_id    uuid not null references public.gyms (id) on delete cascade,
  created_by     uuid references auth.users (id) on delete set null,

  source         text not null default 'csv' check (source in ('csv','mindbody')),
  filename       text,
  status         text not null default 'completed'
                   check (status in ('completed','failed')),
  row_count      integer not null default 0,
  imported_count integer not null default 0,
  updated_count  integer not null default 0,
  skipped_count  integer not null default 0,

  -- Why rows were skipped, capped to a sample. Never contains a full member
  -- record, only the field that failed and the row number.
  report         jsonb not null default '{}'::jsonb
);

create index if not exists imports_gym_idx
  on public.imports (gym_id, created_at desc);

alter table public.imports enable row level security;

create policy imports_select on public.imports
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert, update, delete on public.imports to service_role;
grant select on public.imports to authenticated;

comment on table public.imports is
  'Audit trail of member list imports. Retention: kept for the life of the gym account, deleted with it.';

-- ---------------------------------------------------------------------------
-- members — the sensitive table
-- ---------------------------------------------------------------------------

create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  gym_id   uuid not null references public.gyms (id) on delete cascade,
  import_id     uuid references public.imports (id) on delete set null,

  -- The gym's own member id, when the export carries one. Makes repeat
  -- imports update rather than duplicate.
  external_ref  text,

  first_name    text,
  last_name     text,
  email         text,
  phone         text,

  last_visit_at date,
  visit_count   integer not null default 0 check (visit_count >= 0),

  -- Lifecycle casdey controls. Lapse itself is NOT stored: it is derived at
  -- query time from last_visit_at, visit_count and the gym's own window,
  -- so changing the window never leaves stale flags behind.
  status        text not null default 'active'
                  check (status in ('active','contacted','returned','opted_out')),
  contacted_at  timestamptz,
  returned_at timestamptz,

  -- The gym asserts it may contact this member. False suppresses them
  -- everywhere, regardless of campaign.
  consent_email boolean not null default true,
  source        text not null default 'csv'
);

-- Deliberately plain unique indexes rather than partial or expression ones.
--
-- Two reasons. Postgres treats NULLs as distinct in a unique index, so a plain
-- index already allows any number of members with no external_ref, which is
-- what a partial index was reaching for. And ON CONFLICT can only infer an
-- index from a bare column list: a partial or lower(email) index is silently
-- not matched, and the import fails with "no unique constraint matching the ON
-- CONFLICT specification" instead of updating.
--
-- Emails are lowercased by the application before they are written, exactly as
-- waitlist_signups does, so a plain index on email is enough.
create unique index if not exists members_gym_ref_key
  on public.members (gym_id, external_ref);

create unique index if not exists members_gym_email_key
  on public.members (gym_id, email);

create index if not exists members_lapse_idx
  on public.members (gym_id, last_visit_at, visit_count);

create index if not exists members_status_idx
  on public.members (gym_id, status);

create trigger members_touch
  before update on public.members
  for each row execute function public.touch_updated_at();

alter table public.members enable row level security;

create policy members_select on public.members
  for select to authenticated
  using (public.is_gym_user(gym_id));

create policy members_update on public.members
  for update to authenticated
  using (public.is_gym_user(gym_id))
  with check (public.is_gym_user(gym_id));

create policy members_delete on public.members
  for delete to authenticated
  using (public.is_gym_user(gym_id));

-- Inserts are server-side only (import runs in batches with gym_id pinned
-- from the session, never from the request body).

grant select, insert, update, delete on public.members to service_role;
grant select, update, delete on public.members to authenticated;

comment on table public.members is
  'Member contact details and visit history, uploaded by the gym. The gym is the controller, casdey the processor. Health-adjacent personal data: never export, never log, never send to a third party. Retention: deleted within 30 days of the gym account closing, or immediately on erasure request.';

-- ---------------------------------------------------------------------------
-- suppressions — the do-not-contact list
-- ---------------------------------------------------------------------------

create table if not exists public.suppressions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  email       text not null,
  reason      text not null default 'unsubscribed'
                check (reason in ('unsubscribed','bounced','complained','manual')),
  unique (gym_id, email)
);

alter table public.suppressions enable row level security;

create policy suppressions_select on public.suppressions
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert, update, delete on public.suppressions to service_role;
grant select on public.suppressions to authenticated;

comment on table public.suppressions is
  'Addresses that must never be contacted again for this gym. Checked before every single send. Survives member deletion on purpose: forgetting an unsubscribe would mean emailing someone who asked us to stop. Retention: indefinite, minimal data (email only).';

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  gym_id   uuid not null references public.gyms (id) on delete cascade,
  created_by    uuid references auth.users (id) on delete set null,

  name          text not null,
  status        text not null default 'draft'
                  check (status in ('draft','sending','sent','paused','cancelled')),
  channel       text not null default 'email' check (channel in ('email')),

  subject       text not null,
  body          text not null,

  -- Snapshot of the lapse rule at build time, so a campaign's audience is
  -- reproducible even if the gym later changes its settings.
  audience      jsonb not null default '{}'::jsonb,

  -- Nothing sends until a human at the gym approves it.
  approved_at   timestamptz,
  approved_by   uuid references auth.users (id) on delete set null,
  started_at    timestamptz,
  completed_at  timestamptz
);

create index if not exists campaigns_gym_idx
  on public.campaigns (gym_id, created_at desc);

create trigger campaigns_touch
  before update on public.campaigns
  for each row execute function public.touch_updated_at();

alter table public.campaigns enable row level security;

create policy campaigns_select on public.campaigns
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert, update, delete on public.campaigns to service_role;
grant select on public.campaigns to authenticated;

comment on table public.campaigns is
  'A re-engagement send. Never auto-starts: approved_at must be set by a member of the gym.';

-- ---------------------------------------------------------------------------
-- campaign_messages — the send queue
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_messages (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  gym_id   uuid not null references public.gyms (id) on delete cascade,
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,

  -- Denormalised so a send never has to re-read the member row, and so a
  -- deleted member cannot be re-contacted by an in-flight batch.
  to_email      text not null,

  status        text not null default 'queued'
                  check (status in ('queued','sent','failed','suppressed','cancelled')),
  send_after    timestamptz not null default now(),
  attempts      integer not null default 0,
  sent_at       timestamptz,
  error         text,

  -- One-click unsubscribe, no login. Random and per-message so a leaked link
  -- cannot be used to enumerate anyone else. Two v4 UUIDs concatenated (64 hex
  -- chars, ~240 bits) rather than gen_random_bytes, which lives in the pgcrypto
  -- extension and is not always on the inserting role's search path.
  unsubscribe_token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  unique (campaign_id, member_id)
);

create index if not exists campaign_messages_queue_idx
  on public.campaign_messages (status, send_after)
  where status = 'queued';

create index if not exists campaign_messages_campaign_idx
  on public.campaign_messages (campaign_id, status);

alter table public.campaign_messages enable row level security;

create policy campaign_messages_select on public.campaign_messages
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert, update, delete on public.campaign_messages to service_role;
grant select on public.campaign_messages to authenticated;

comment on table public.campaign_messages is
  'One queued or sent message per member per campaign. Holds a member email address: same handling rules as public.members.';

-- ---------------------------------------------------------------------------
-- member_events — the timeline
-- ---------------------------------------------------------------------------

create table if not exists public.member_events (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  type        text not null
                check (type in ('imported','message_sent','message_failed','replied','returned','opted_out')),
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists member_events_member_idx
  on public.member_events (member_id, occurred_at desc);

create index if not exists member_events_gym_type_idx
  on public.member_events (gym_id, type, occurred_at desc);

alter table public.member_events enable row level security;

create policy member_events_select on public.member_events
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert, update, delete on public.member_events to service_role;
grant select on public.member_events to authenticated;

comment on table public.member_events is
  'What happened to a member and when. Deleted with the member. Feeds the returned marker on the dashboard.';

-- ---------------------------------------------------------------------------
-- audit_log — GDPR accountability
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  actor_email text,
  action      text not null,
  target      text,
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_gym_idx
  on public.audit_log (gym_id, created_at desc);

alter table public.audit_log enable row level security;

create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert on public.audit_log to service_role;
grant select on public.audit_log to authenticated;

comment on table public.audit_log is
  'Who touched member data and what they did. Append only: no update or delete grant, deliberately. Retention: 24 months.';

-- ---------------------------------------------------------------------------
-- stripe_events — webhook idempotency
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_events (
  id           text primary key,
  received_at  timestamptz not null default now(),
  type         text not null
);

alter table public.stripe_events enable row level security;
-- No policies: server-side only, never read by a user.

grant select, insert on public.stripe_events to service_role;

comment on table public.stripe_events is
  'Stripe event ids already processed. Stripe retries webhooks, so every handler checks here first.';

-- ---------------------------------------------------------------------------
-- create_gym — the one write that must be atomic
-- ---------------------------------------------------------------------------

create or replace function public.create_gym(
  p_user_id       uuid,
  p_name          text,
  p_country       text,
  p_timezone      text,
  p_contact_email text,
  p_sender_name   text,
  p_reply_to_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  -- One gym per user in v1. Without this, a double-submitted onboarding
  -- form silently creates a second tenant and the first one's data disappears
  -- from view.
  if exists (select 1 from public.gym_users where user_id = p_user_id) then
    raise exception 'user already belongs to a gym'
      using errcode = 'unique_violation';
  end if;

  insert into public.gyms
    (name, country, timezone, contact_email, sender_name, reply_to_email)
  values
    (p_name, p_country, p_timezone, p_contact_email, p_sender_name, p_reply_to_email)
  returning id into v_gym_id;

  insert into public.gym_users (gym_id, user_id, role)
  values (v_gym_id, p_user_id, 'owner');

  return v_gym_id;
end;
$$;

-- Server-side only: the caller passes p_user_id from a session it has already
-- verified. Never grant this to `authenticated`, or a user could hand it
-- somebody else's id.
grant execute on function public.create_gym(uuid, text, text, text, text, text, text)
  to service_role;
