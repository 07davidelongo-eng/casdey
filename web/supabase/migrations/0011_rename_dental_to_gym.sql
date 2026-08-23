-- casdey: rename the pre-launch SaaS schema from dental to gym/fitness terms.
--
-- WHY: casdey pivoted its niche from dental practices to gyms and fitness
-- studios. The app code and the canonical migrations (0002-0010) were rewritten
-- to gym-native names; this migration brings an ALREADY-PROVISIONED project's
-- SaaS tables in line, in place, preserving any existing rows.
--
-- HOW: run this ONCE in the Supabase SQL editor, against the same project that
-- holds `waitlist_signups`. It is written to be safe to re-run (idempotent
-- guards throughout).
--
-- SCOPE / SAFETY:
--   * `waitlist_signups` is deliberately NOT touched. Its columns keep their
--     original names (practice_name / practice_software); only the gym-facing
--     copy on the site changed. The live waitlist form keeps working.
--   * The currently-DEPLOYED app still uses the OLD table names (practices,
--     patients, ...). Apply this migration together with deploying the
--     gym-renamed code, or the deployed API routes (cron send, Stripe webhook)
--     will error against the renamed tables until the new code is live.
--   * The four WhatsApp tables and the WhatsApp columns are DROPPED: the channel
--     was removed in the pivot.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- 1. Drop the WhatsApp channel entirely (tables + columns)
-- ---------------------------------------------------------------------------
drop table if exists public.whatsapp_messages cascade;
drop table if exists public.whatsapp_conversations cascade;
drop table if exists public.whatsapp_suppressions cascade;
drop table if exists public.whatsapp_events cascade;

alter table public.practices  drop column if exists whatsapp_enabled;
alter table public.practices  drop column if exists whatsapp_template_name;
alter table public.patients   drop column if exists consent_whatsapp;

-- ---------------------------------------------------------------------------
-- 2. Rename the tables
-- ---------------------------------------------------------------------------
alter table if exists public.practices         rename to gyms;
alter table if exists public.practice_members  rename to gym_users;
alter table if exists public.patients          rename to members;
alter table if exists public.patient_events    rename to member_events;
alter table if exists public.practice_services rename to services;
alter table if exists public.appointments      rename to bookings;

-- ---------------------------------------------------------------------------
-- 3. Rename the foreign-key + value columns
--    (indexes and FK constraints track columns by attribute, so they follow
--     the rename automatically; ON CONFLICT still infers by column list.)
-- ---------------------------------------------------------------------------
-- practice_id -> gym_id, on every table that carries it
alter table public.gym_users             rename column practice_id to gym_id;
alter table public.imports               rename column practice_id to gym_id;
alter table public.members               rename column practice_id to gym_id;
alter table public.suppressions          rename column practice_id to gym_id;
alter table public.campaigns             rename column practice_id to gym_id;
alter table public.campaign_messages     rename column practice_id to gym_id;
alter table public.member_events         rename column practice_id to gym_id;
alter table public.audit_log             rename column practice_id to gym_id;
alter table public.services              rename column practice_id to gym_id;
alter table public.guarantee_claims      rename column practice_id to gym_id;
alter table public.subscription_payments rename column practice_id to gym_id;
alter table public.calendar_connections  rename column practice_id to gym_id;
alter table public.bookings              rename column practice_id to gym_id;

-- patient_id -> member_id
alter table public.campaign_messages rename column patient_id to member_id;
alter table public.member_events     rename column patient_id to member_id;
alter table public.bookings          rename column patient_id to member_id;

-- gym / member value columns
alter table public.gyms    rename column dormant_after_months    to lapsed_after_months;
alter table public.gyms    rename column appointment_value_minor to booking_value_minor;
alter table public.members rename column reactivated_at          to returned_at;

-- ---------------------------------------------------------------------------
-- 4. CHECK-constraint value changes (reactivated -> returned, rebooked ->
--    returned, channel back to email-only). Existing rows are migrated first,
--    and the old constraint is found dynamically so this does not depend on an
--    auto-generated constraint name.
-- ---------------------------------------------------------------------------
-- members.status: 'reactivated' -> 'returned'
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.members'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then execute format('alter table public.members drop constraint %I', c); end if;
end $$;
update public.members set status = 'returned' where status = 'reactivated';
alter table public.members
  add constraint members_status_check
  check (status in ('active','contacted','returned','opted_out'));

-- member_events.type: 'rebooked' -> 'returned' (keeps 'booked')
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.member_events'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%type%';
  if c is not null then execute format('alter table public.member_events drop constraint %I', c); end if;
end $$;
update public.member_events set type = 'returned' where type = 'rebooked';
alter table public.member_events
  add constraint member_events_type_check
  check (type in ('imported','message_sent','message_failed','replied','returned','booked','opted_out'));

-- imports.source: the direct-integration stub id 'dentally' -> 'mindbody'
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.imports'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%source%';
  if c is not null then execute format('alter table public.imports drop constraint %I', c); end if;
end $$;
update public.imports set source = 'mindbody' where source = 'dentally';
alter table public.imports
  add constraint imports_source_check check (source in ('csv','mindbody'));

-- campaigns.channel: back to email-only (whatsapp value removed)
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.campaigns'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%channel%';
  if c is not null then execute format('alter table public.campaigns drop constraint %I', c); end if;
end $$;
update public.campaigns set channel = 'email' where channel <> 'email';
alter table public.campaigns
  add constraint campaigns_channel_check check (channel in ('email'));

-- ---------------------------------------------------------------------------
-- 5. Rename the functions (and refresh their bodies for the new table names).
--    Renaming keeps the OID, so RLS policies that call these keep working.
-- ---------------------------------------------------------------------------
-- ALTER FUNCTION has no IF EXISTS clause in Postgres (unlike ALTER TABLE) --
-- guard each rename manually by checking pg_proc first.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'is_practice_member') then
    alter function public.is_practice_member(uuid) rename to is_gym_user;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'is_practice_owner') then
    alter function public.is_practice_owner(uuid) rename to is_gym_owner;
  end if;
end $$;

-- CREATE OR REPLACE cannot rename an existing input parameter (only DROP +
-- recreate can, which would assign a new OID and risk breaking whatever RLS
-- policies already depend on this function's current OID -- exactly what the
-- RENAME above was chosen to avoid). The live database confirmed the existing
-- parameter is named p_practice_id, so keep that name here; only the
-- function's own name and body change.
create or replace function public.is_gym_user(p_practice_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.gym_users m
    where m.gym_id = p_practice_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_gym_owner(p_practice_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.gym_users m
    where m.gym_id = p_practice_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- create_practice -> create_gym (plpgsql body must be rewritten for new names)
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'create_practice') then
    alter function public.create_practice(uuid, text, text, text, text, text, text) rename to create_gym;
  end if;
end $$;

create or replace function public.create_gym(
  p_user_id        uuid,
  p_name           text,
  p_country        text,
  p_timezone       text,
  p_contact_email  text,
  p_sender_name    text,
  p_reply_to_email text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  if exists (select 1 from public.gym_users where user_id = p_user_id) then
    raise exception 'user already belongs to a gym' using errcode = 'unique_violation';
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

grant execute on function public.is_gym_user(uuid)  to authenticated, service_role;
grant execute on function public.is_gym_owner(uuid) to authenticated, service_role;
grant execute on function public.create_gym(uuid, text, text, text, text, text, text)
  to service_role;
