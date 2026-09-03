-- WhatsApp channel — revived for the gym product (Track E1 in SAAS_V1_PLAN.md).
--
-- HISTORY: this channel first shipped for the dental build as migration 0009
-- (`0009_whatsapp_channel.sql`), then was dropped wholesale by 0011 when casdey
-- pivoted to gyms and Davide judged WhatsApp a poor fit. An engaged outreach
-- lead (JD) asked for it back, so it returns as a V1 target. This migration
-- re-adds the same structures 0011 dropped, but gym-native from the start:
-- `gyms` / `members` / `gym_id` / `member_id` / `is_gym_user`.
--
-- Design choices (unchanged from 0009):
--   1. One shared casdey WhatsApp sender for every gym (mirrors the shared
--      mail.casdey.com email domain), not a number per gym. `whatsapp_enabled`
--      is the per-tenant kill switch: a gym must opt in before the shared
--      number is ever used on its behalf.
--   2. Email's send queue (`campaign_messages`) is the wrong shape for a
--      back-and-forth thread, so `whatsapp_conversations` (one per member) and
--      `whatsapp_messages` (every message in it) are separate tables.
--   3. `whatsapp_events` mirrors `stripe_events`: inbound-webhook idempotency,
--      server-only, no RLS policies.
--   4. `whatsapp_suppressions` mirrors `suppressions` but keyed on phone,
--      because "reply STOP" has no unsubscribe-link token equivalent.
--
-- Safe to re-run: idempotent guards throughout.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- campaigns.channel — widen back to allow whatsapp
-- ---------------------------------------------------------------------------

alter table public.campaigns
  drop constraint if exists campaigns_channel_check;

alter table public.campaigns
  add constraint campaigns_channel_check check (channel in ('email','whatsapp'));

-- WhatsApp has no freeform first-contact copy (Meta requires a pre-approved
-- template), so subject/body hold nothing for a WhatsApp campaign. The template
-- name is frozen on the campaign row rather than read live from
-- gyms.whatsapp_template_name at send time, same reasoning as the `audience`
-- snapshot: a campaign's record of what it sent must not drift later.
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
-- members.consent_whatsapp — mirrors consent_email
-- ---------------------------------------------------------------------------

alter table public.members
  add column if not exists consent_whatsapp boolean not null default true;

comment on column public.members.consent_whatsapp is
  'The gym asserts it may WhatsApp this member. False suppresses them from every WhatsApp campaign, regardless of consent_email.';

-- ---------------------------------------------------------------------------
-- gyms — per-tenant WhatsApp configuration
-- ---------------------------------------------------------------------------

alter table public.gyms
  add column if not exists whatsapp_enabled boolean not null default false;

alter table public.gyms
  add column if not exists whatsapp_template_name text;

comment on column public.gyms.whatsapp_enabled is
  'Per-gym opt-in to the shared casdey WhatsApp sender. Off by default: the number is shared across every gym, so nobody is contacted over WhatsApp until this is explicitly turned on.';

comment on column public.gyms.whatsapp_template_name is
  'Name of the Meta-approved template used for cold first contact (business-initiated sends outside the 24h service window need an approved template). Null blocks WhatsApp campaigns for this gym until one is configured.';

-- ---------------------------------------------------------------------------
-- whatsapp_conversations — one thread per member
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_conversations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  gym_id          uuid not null references public.gyms (id) on delete cascade,
  member_id       uuid not null references public.members (id) on delete cascade,

  -- Denormalised so inbound routing can match a phone number without a join.
  phone           text not null,

  status          text not null default 'active'
                    check (status in ('active','booking_requested','opted_out','closed')),

  -- Cost/runaway guardrail for the AI reply loop: capped in application code,
  -- persisted here so the cap survives across separate webhook invocations.
  ai_turns_count  integer not null default 0 check (ai_turns_count >= 0),

  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,

  unique (gym_id, member_id)
);

-- The shared number means inbound routing has no per-gym signal to key on
-- beyond the phone number itself, so it picks the most recently active
-- conversation for that number. This index makes that lookup cheap.
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
  using (public.is_gym_user(gym_id));

grant select, insert, update, delete on public.whatsapp_conversations to service_role;
grant select on public.whatsapp_conversations to authenticated;

comment on table public.whatsapp_conversations is
  'One WhatsApp conversation thread per member. Holds a phone number: same handling rules as public.members.';

-- ---------------------------------------------------------------------------
-- whatsapp_messages — every inbound/outbound message in a conversation
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_messages (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  conversation_id      uuid not null references public.whatsapp_conversations (id) on delete cascade,

  -- Denormalised for the RLS policy, same reasoning as campaign_messages.
  gym_id               uuid not null references public.gyms (id) on delete cascade,

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
  using (public.is_gym_user(gym_id));

grant select, insert, update, delete on public.whatsapp_messages to service_role;
grant select on public.whatsapp_messages to authenticated;

comment on table public.whatsapp_messages is
  'Every inbound and outbound message in a WhatsApp conversation. Holds message content to/from a member: same handling rules as public.members.';

-- ---------------------------------------------------------------------------
-- whatsapp_suppressions — the WhatsApp do-not-contact list
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_suppressions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  phone       text not null,
  reason      text not null default 'unsubscribed'
                check (reason in ('unsubscribed','bounced','complained','manual')),
  unique (gym_id, phone)
);

alter table public.whatsapp_suppressions enable row level security;

drop policy if exists whatsapp_suppressions_select on public.whatsapp_suppressions;

create policy whatsapp_suppressions_select on public.whatsapp_suppressions
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert, update, delete on public.whatsapp_suppressions to service_role;
grant select on public.whatsapp_suppressions to authenticated;

comment on table public.whatsapp_suppressions is
  'Phone numbers that must never be WhatsApped again for this gym. Checked before every send. Survives member deletion on purpose, same as public.suppressions.';

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

-- ---------------------------------------------------------------------------
-- claim_whatsapp_ai_turn — atomic reply-cap claim
-- ---------------------------------------------------------------------------
-- The AI reply loop used to read ai_turns_count, compare it to the cap, then
-- write count + 1 in a later statement. Two webhook deliveries racing (Twilio
-- can deliver two inbound messages near-simultaneously) both read the same
-- value and both send, blowing past the cap. This claims one turn atomically:
-- it returns the new count if a turn was available, or null if the
-- conversation is no longer active or the cap is already reached. Callers must
-- treat null as "do not reply".

create or replace function public.claim_whatsapp_ai_turn(
  p_conversation_id uuid,
  p_max_turns integer
)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.whatsapp_conversations
     set ai_turns_count = ai_turns_count + 1
   where id = p_conversation_id
     and status = 'active'
     and ai_turns_count < p_max_turns
  returning ai_turns_count;
$$;

grant execute on function public.claim_whatsapp_ai_turn(uuid, integer) to service_role;

comment on table public.whatsapp_events is
  'Twilio message SIDs already processed by the inbound webhook. Twilio retries webhooks, so the handler checks here first, same pattern as public.stripe_events.';
