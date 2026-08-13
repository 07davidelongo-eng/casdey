-- casdey waitlist
--
-- Run this in the Supabase SQL editor (or via the CLI) against a project
-- created in an EU region. The landing page tells practices their data stays in
-- the UK and the EU, so the region is a compliance choice, not a latency one.

create table if not exists public.waitlist_signups (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  practice_name     text not null,
  email             text not null,
  practice_software text,
  source            text not null default 'casdey.com'
);

-- Emails are lowercased by the application before insert, so a plain unique
-- constraint is enough to keep one row per practice.
create unique index if not exists waitlist_signups_email_key
  on public.waitlist_signups (email);

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

-- Row level security on with no policies at all: the anon and authenticated
-- roles can do nothing here. Only the service role, which bypasses RLS and is
-- used exclusively from the server, can read or write. If the publishable key
-- ever leaks, this table is still closed.
alter table public.waitlist_signups enable row level security;

-- BYPASSRLS on service_role skips row level security, but it does not skip
-- table-level grants, which are a separate permission layer and are not
-- always set up automatically for tables created via the SQL editor. Without
-- this, every insert fails with "permission denied for table" before RLS is
-- ever evaluated.
grant usage on schema public to service_role;
grant select, insert on public.waitlist_signups to service_role;

comment on table public.waitlist_signups is
  'Practices who joined the casdey waitlist. Business contact details only, never patient data. Retention: deleted 24 months after signup at the latest, per the privacy notice at casdey.com/privacy.';
