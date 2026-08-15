-- Calendar-booking loop (the close-the-loop feature): a dormant patient books
-- a real appointment themselves from a link in casdey's message, and it lands
-- both in casdey and in the practice's Google Calendar.
--
-- Design choices this migration encodes:
--
--   1. A casdey-OWNED booking record (`appointments`) is the source of truth,
--      not the practice's PMS diary. Writing into Dentally/EXACT/R4 is blocked
--      on partner API access (the same wall the import stub hit), so casdey
--      keeps its own bookings and optionally mirrors them into the one diary it
--      can reach today: Google Calendar (`calendar_connections`).
--   2. Availability is practice-configured (`practices.booking_*`) and the open
--      slots are computed in application code (src/lib/calendar/availability.ts)
--      from those hours minus Google free/busy minus existing appointments. The
--      DB stores the settings, not the computed slots.
--   3. A booking reuses the existing reactivation signal: it flips the patient
--      to status='reactivated' + reactivated_at, which the dashboard
--      (src/lib/stats.ts) and the profit-or-nothing guarantee
--      (src/lib/guarantee-data.ts) already count. No changes needed there.
--   4. Tokens (patients.booking_token, appointments.booking_token) mirror
--      campaign_messages.unsubscribe_token: opaque, DB-generated, the target of
--      a public token-gated page (src/app/book/[token], like /u/[token]).

-- ---------------------------------------------------------------------------
-- practices — per-practice booking configuration
-- ---------------------------------------------------------------------------

alter table public.practices
  add column if not exists booking_enabled boolean not null default false;

-- Length of one appointment slot offered to patients, in minutes.
alter table public.practices
  add column if not exists booking_slot_minutes integer not null default 30
    check (booking_slot_minutes between 5 and 480);

-- Gap kept clear after each booked slot, in minutes.
alter table public.practices
  add column if not exists booking_buffer_minutes integer not null default 0
    check (booking_buffer_minutes between 0 and 240);

-- How far ahead a patient must book (no same-hour bookings), in hours.
alter table public.practices
  add column if not exists booking_min_notice_hours integer not null default 24
    check (booking_min_notice_hours between 0 and 720);

-- How far into the future slots are offered, in days.
alter table public.practices
  add column if not exists booking_horizon_days integer not null default 21
    check (booking_horizon_days between 1 and 120);

-- Per-weekday open windows in the practice's own timezone, e.g.
-- {"mon":[["09:00","13:00"],["14:00","17:00"]], "tue":[...], ...}. An empty
-- object (the default) means no availability, so booking offers nothing until
-- the practice sets its hours.
alter table public.practices
  add column if not exists booking_hours jsonb not null default '{}'::jsonb;

comment on column public.practices.booking_enabled is
  'Master switch for self-serve booking. Off by default: no booking link is emitted and the public booking page declines until a practice turns this on and sets its hours.';

comment on column public.practices.booking_hours is
  'Per-weekday open windows ("mon".."sun" -> array of ["HH:MM","HH:MM"]) in practices.timezone. Empty means no availability. Computed slots are never stored, only these rules.';

-- ---------------------------------------------------------------------------
-- patients.booking_token — the per-patient link target
-- ---------------------------------------------------------------------------

alter table public.patients
  add column if not exists booking_token uuid not null default gen_random_uuid();

create unique index if not exists patients_booking_token_idx
  on public.patients (booking_token);

comment on column public.patients.booking_token is
  'Opaque per-patient token behind the booking link in a message (/book/<token>). Mirrors campaign_messages.unsubscribe_token: unguessable, stable, DB-generated.';

-- ---------------------------------------------------------------------------
-- patient_events.type — allow 'booked'
-- ---------------------------------------------------------------------------

-- 'booked' is a self-serve booking through casdey; 'rebooked' stays the manual
-- staff mark. Both flip the patient to reactivated, which is what the dashboard
-- and guarantee count, so the distinction is only for the timeline.
alter table public.patient_events
  drop constraint if exists patient_events_type_check;

alter table public.patient_events
  add constraint patient_events_type_check check (
    type in ('imported','message_sent','message_failed','replied','rebooked','booked','opted_out')
  );

-- ---------------------------------------------------------------------------
-- calendar_connections — one connected calendar per practice
-- ---------------------------------------------------------------------------

create table if not exists public.calendar_connections (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  practice_id        uuid not null references public.practices (id) on delete cascade,

  -- Provider-abstracted for a future Outlook/Dentally adapter on the same seam.
  provider           text not null default 'google' check (provider in ('google')),

  -- Which of the connected account's calendars casdey writes to. 'primary' is
  -- Google's alias for the account's main calendar.
  google_calendar_id text not null default 'primary',

  -- OAuth tokens, encrypted at rest with CALENDAR_TOKEN_KEY via
  -- src/lib/calendar/tokens.ts. Never stored or logged in plaintext.
  access_token_enc   text,
  refresh_token_enc  text,
  token_expires_at   timestamptz,

  -- The Google account email, shown in Settings so the practice can see which
  -- account is connected.
  connected_email    text,

  status             text not null default 'active' check (status in ('active','revoked')),

  -- One live connection per practice for V1.
  unique (practice_id)
);

drop trigger if exists calendar_connections_touch on public.calendar_connections;

create trigger calendar_connections_touch
  before update on public.calendar_connections
  for each row execute function public.touch_updated_at();

alter table public.calendar_connections enable row level security;

drop policy if exists calendar_connections_select on public.calendar_connections;

-- A practice can see THAT a calendar is connected (and which account), but the
-- token columns are never sent to the browser: pages select explicit columns,
-- never the encrypted tokens. Writes go through the service role after an owner
-- check, same as every other settings change.
create policy calendar_connections_select on public.calendar_connections
  for select to authenticated
  using (public.is_practice_member(practice_id));

grant select, insert, update, delete on public.calendar_connections to service_role;
grant select on public.calendar_connections to authenticated;

comment on table public.calendar_connections is
  'A practice''s connected external calendar (Google for V1). Holds encrypted OAuth tokens: service-role access only, token columns never leave the server.';

-- ---------------------------------------------------------------------------
-- appointments — the casdey-owned booking record
-- ---------------------------------------------------------------------------

create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  practice_id     uuid not null references public.practices (id) on delete cascade,
  patient_id      uuid not null references public.patients (id) on delete cascade,

  -- Which treatment was booked, if the patient picked one. Nullable: a generic
  -- "appointment" is fine. Snapshotting the value below means deleting the
  -- service later never rewrites history, so this is set null on delete.
  service_id      uuid references public.practice_services (id) on delete set null,

  start_at        timestamptz not null,
  end_at          timestamptz not null,

  status          text not null default 'booked'
                    check (status in ('booked','cancelled','completed','no_show')),

  -- The Google Calendar event id, once mirrored. Null in casdey-owned-only mode
  -- or before the mirror write succeeds.
  google_event_id text,

  -- Value of this appointment in minor units, snapshotted at booking from the
  -- picked service's price or the practice's default appointment value. Frozen
  -- so a later price change never rewrites what a past booking was worth.
  value_minor     integer check (value_minor is null or value_minor >= 0),

  created_via     text not null default 'self_serve'
                    check (created_via in ('self_serve','staff')),

  -- Opaque token for the patient's own manage/cancel page (/book/<token>/manage).
  booking_token   uuid not null default gen_random_uuid(),

  cancelled_at    timestamptz,

  check (end_at > start_at)
);

-- The double-book guard: at most one live booking can hold a given start time
-- for a practice. A second concurrent booking of the same slot fails the insert
-- rather than racing through.
create unique index if not exists appointments_slot_idx
  on public.appointments (practice_id, start_at)
  where status = 'booked';

create index if not exists appointments_practice_start_idx
  on public.appointments (practice_id, start_at);

create index if not exists appointments_patient_idx
  on public.appointments (patient_id, start_at desc);

create unique index if not exists appointments_booking_token_idx
  on public.appointments (booking_token);

drop trigger if exists appointments_touch on public.appointments;

create trigger appointments_touch
  before update on public.appointments
  for each row execute function public.touch_updated_at();

alter table public.appointments enable row level security;

drop policy if exists appointments_select on public.appointments;

create policy appointments_select on public.appointments
  for select to authenticated
  using (public.is_practice_member(practice_id));

grant select, insert, update, delete on public.appointments to service_role;
grant select on public.appointments to authenticated;

comment on table public.appointments is
  'casdey-owned bookings. The source of truth for who booked and when, optionally mirrored to the practice''s Google Calendar. Deleted with the patient/practice.';
