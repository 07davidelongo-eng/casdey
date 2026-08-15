-- WhatsApp channel (roadmap item #2): a second contact channel alongside
-- email, with a responsive AI agent instead of a single templated send.
--
-- Design choices this migration encodes:
--
--   1. One shared casdey WhatsApp sender for every practice (mirrors the
--      shared mail.casdey.com email domain), not a number per practice.
--      Provisioning a Meta-approved WhatsApp sender per practice is not
--      realistic to do by hand right now. `whatsapp_enabled` is the
--      per-tenant kill switch: a practice must opt in before the shared
--      number is ever used on its behalf.
--   2. Email's send queue (`campaign_messages`, one row per patient per
--      campaign) is the wrong shape for WhatsApp: a campaign there is a
--      single outbound message, but WhatsApp needs a real back-and-forth
--      thread. `whatsapp_conversations` (one per patient) and
--      `whatsapp_messages` (every inbound/outbound message in it) are new,
--      separate tables rather than a forced fit into campaign_messages.
--   3. `whatsapp_events` mirrors `stripe_events` exactly: inbound-webhook
--      idempotency, server-only, no RLS policies.
--   4. `whatsapp_suppressions` mirrors `suppressions` but keyed on phone,
--      because WhatsApp opt-out ("reply STOP") has no equivalent to the
--      unsubscribe-link token email uses.

-- ---------------------------------------------------------------------------
-- campaigns.channel — widen to allow whatsapp
-- ---------------------------------------------------------------------------

alter table public.campaigns
  drop constraint if exists campaigns_channel_check;

alter table public.campaigns
  add constraint campaigns_channel_check check (channel in ('email','whatsapp'));

-- WhatsApp has no freeform first-contact copy (Meta requires a pre-approved
-- template), so subject/body have nothing to hold for a WhatsApp campaign.
-- Frozen here rather than read live from practices.whatsapp_template_name at
-- send time, same reasoning as the `audience` snapshot: a campaign's record
-- of what it sent must not drift if the practice's template config changes
-- later.
alter table public.campaigns
  alter column subject drop not null;

alter table public.campaigns
  alter column body drop not null;

alter table public.campaigns
  add column if not exists whatsapp_template_name text;

alter table public.campaigns
  drop constraint if exists campaigns_channel_fields_check;

alter table public.campaigns
  add constraint campaigns_channel_fields_check check (
    case channel
      when 'email' then subject is not null and body is not null
      when 'whatsapp' then whatsapp_template_name is not null
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- patients.consent_whatsapp — mirrors consent_email
-- ---------------------------------------------------------------------------

alter table public.patients
  add column if not exists consent_whatsapp boolean not null default true;

comment on column public.patients.consent_whatsapp is
  'The practice asserts it may WhatsApp this patient. False suppresses them from every WhatsApp campaign, regardless of consent_email.';

-- ---------------------------------------------------------------------------
-- practices — per-tenant WhatsApp configuration
-- ---------------------------------------------------------------------------

alter table public.practices
  add column if not exists whatsapp_enabled boolean not null default false;

alter table public.practices
  add column if not exists whatsapp_template_name text;

comment on column public.practices.whatsapp_enabled is
  'Per-practice opt-in to the shared casdey WhatsApp sender. Off by default: the number is shared across every practice, so nobody is contacted over WhatsApp until they explicitly turn this on.';

comment on column public.practices.whatsapp_template_name is
  'Name of the Meta-approved message template used for cold first contact (business-initiated sends require an approved template outside the 24h customer-service window). Null means WhatsApp campaigns are blocked for this practice until one is configured.';

-- ---------------------------------------------------------------------------
-- whatsapp_conversations — one thread per patient
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_conversations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  practice_id     uuid not null references public.practices (id) on delete cascade,
  patient_id      uuid not null references public.patients (id) on delete cascade,

  -- Denormalised so inbound routing can match a phone number without a join.
  phone           text not null,

  status          text not null default 'active'
                    check (status in ('active','booking_requested','opted_out','closed')),

  -- Cost/runaway guardrail for the AI reply loop: capped in application code,
  -- persisted here so the cap survives across separate webhook invocations.
  ai_turns_count  integer not null default 0 check (ai_turns_count >= 0),

  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,

  unique (practice_id, patient_id)
);

-- The shared number means inbound routing has no per-practice signal to key
-- on beyond the phone number itself, so it picks the most recently active
-- conversation for that number. This index is what makes that lookup cheap.
create index if not exists whatsapp_conversations_phone_idx
  on public.whatsapp_conversations (phone, updated_at desc);

drop trigger if exists whatsapp_conversations_touch on public.whatsapp_conversations;

create trigger whatsapp_conversations_touch
  before update on public.whatsapp_conversations
  for each row execute function public.touch_updated_at();

alter table public.whatsapp_conversations enable row level security;

drop policy if exists whatsapp_conversations_select on public.whatsapp_conversations;

create policy whatsapp_conversations_select on public.whatsapp_conversations
  for select to authenticated
  using (public.is_practice_member(practice_id));

grant select, insert, update, delete on public.whatsapp_conversations to service_role;
grant select on public.whatsapp_conversations to authenticated;

comment on table public.whatsapp_conversations is
  'One WhatsApp conversation thread per patient. Holds a phone number: same handling rules as public.patients.';

-- ---------------------------------------------------------------------------
-- whatsapp_messages — every inbound/outbound message in a conversation
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_messages (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  conversation_id      uuid not null references public.whatsapp_conversations (id) on delete cascade,

  -- Denormalised for the RLS policy, same reasoning as campaign_messages.
  practice_id          uuid not null references public.practices (id) on delete cascade,

  direction            text not null check (direction in ('in','out')),
  body                 text not null,
  provider_message_id  text,
  ai_generated         boolean not null default false
);

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, created_at);

alter table public.whatsapp_messages enable row level security;

drop policy if exists whatsapp_messages_select on public.whatsapp_messages;

create policy whatsapp_messages_select on public.whatsapp_messages
  for select to authenticated
  using (public.is_practice_member(practice_id));

grant select, insert, update, delete on public.whatsapp_messages to service_role;
grant select on public.whatsapp_messages to authenticated;

comment on table public.whatsapp_messages is
  'Every inbound and outbound message in a WhatsApp conversation. Holds message content to/from a patient: same handling rules as public.patients.';

-- ---------------------------------------------------------------------------
-- whatsapp_suppressions — the WhatsApp do-not-contact list
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_suppressions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  phone       text not null,
  reason      text not null default 'unsubscribed'
                check (reason in ('unsubscribed','bounced','complained','manual')),
  unique (practice_id, phone)
);

alter table public.whatsapp_suppressions enable row level security;

drop policy if exists whatsapp_suppressions_select on public.whatsapp_suppressions;

create policy whatsapp_suppressions_select on public.whatsapp_suppressions
  for select to authenticated
  using (public.is_practice_member(practice_id));

grant select, insert, update, delete on public.whatsapp_suppressions to service_role;
grant select on public.whatsapp_suppressions to authenticated;

comment on table public.whatsapp_suppressions is
  'Phone numbers that must never be WhatsApped again for this practice. Checked before every send. Survives patient deletion on purpose, same as public.suppressions.';

-- ---------------------------------------------------------------------------
-- whatsapp_events — inbound webhook idempotency
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_events (
  id          text primary key,
  received_at timestamptz not null default now()
);

alter table public.whatsapp_events enable row level security;
-- No policies: server-side only, never read by a user.

grant select, insert on public.whatsapp_events to service_role;

comment on table public.whatsapp_events is
  'Twilio message SIDs already processed by the inbound webhook. Twilio retries webhooks, so the handler checks here first, same pattern as public.stripe_events.';
