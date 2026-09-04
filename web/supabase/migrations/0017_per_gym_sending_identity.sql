-- Per-gym sending identity: a member hears from their gym, never from casdey.
--
-- The product promise is that casdey contacts lapsed members *as the gym*.
-- Until now that was only half true, and differently broken per channel:
--
--   Email     sent from "Iron Works Gym <no-reply@mail.casdey.com>". The name
--             is the gym's, so an inbox list looks right, but the address is
--             casdey's and shows the moment anyone expands the header.
--   WhatsApp  sent from ONE shared casdey number, whose WhatsApp display name
--             is a property of the number, not the message. Every gym's
--             members saw "casdey". There is no per-message override, so this
--             could not be fixed in copy.
--
-- The fix is the same shape for both: the gym brings its own identity, and
-- casdey sends through it rather than on top of it.
--
--   Email     the gym verifies its own domain with Resend (DNS records it adds
--             itself), and mail goes out from that domain.
--   WhatsApp  the gym connects its own WhatsApp Business Account and number,
--             linked into casdey's Twilio account as its own sender.
--
-- Both fall back cleanly: a gym with nothing configured keeps today's
-- behaviour for email, and simply cannot send WhatsApp.

-- ---------------------------------------------------------------- email ----

alter table public.gyms
  add column if not exists sending_domain text,
  add column if not exists sending_domain_id text,
  add column if not exists sending_domain_status text
    not null default 'none'
    check (sending_domain_status in ('none', 'pending', 'verified', 'failed')),
  add column if not exists sending_domain_records jsonb,
  add column if not exists sending_from_local text not null default 'hello';

comment on column public.gyms.sending_domain is
  'The gym''s own sending domain, e.g. ironworksgym.ie. Null means email still goes out on casdey''s shared domain.';
comment on column public.gyms.sending_domain_id is
  'Resend''s id for the domain, needed to re-check verification later.';
comment on column public.gyms.sending_domain_status is
  'none = never configured. pending = created at Resend, DNS not confirmed. verified = safe to send from. failed = Resend rejected it. Only "verified" changes the From address.';
comment on column public.gyms.sending_domain_records is
  'The DNS records Resend wants, cached so the setup page can show them without an API round trip on every load.';
comment on column public.gyms.sending_from_local is
  'Local part of the From address on the gym''s own domain, so mail is from hello@theirgym.com rather than a casdey-looking mailbox.';

-- A domain belongs to one gym. Two gyms claiming the same domain would let one
-- send as the other, which is the whole thing this migration exists to prevent.
create unique index if not exists gyms_sending_domain_unique
  on public.gyms (lower(sending_domain))
  where sending_domain is not null;

-- ------------------------------------------------------------- whatsapp ----

alter table public.gyms
  add column if not exists whatsapp_from text;

comment on column public.gyms.whatsapp_from is
  'E.164 number of the gym''s OWN WhatsApp sender, e.g. +353871234567. Replaces the single shared TWILIO_WHATSAPP_FROM env var: the number carries the WhatsApp display name, so a shared one can only ever say "casdey". Null means this gym cannot send WhatsApp.';

-- Stored E.164 or not at all. A local-format number here fails at Twilio with
-- an opaque error, the same class of bug that libphonenumber-js was added to
-- kill at CSV import time.
alter table public.gyms
  drop constraint if exists gyms_whatsapp_from_e164;
alter table public.gyms
  add constraint gyms_whatsapp_from_e164
  check (whatsapp_from is null or whatsapp_from ~ '^\+[1-9][0-9]{6,14}$');

-- The same number cannot serve two gyms: WhatsApp routes inbound replies by
-- the sender number, so a shared one would deliver a member's reply to the
-- wrong gym. See the routing note in src/app/api/whatsapp/webhook.
create unique index if not exists gyms_whatsapp_from_unique
  on public.gyms (whatsapp_from)
  where whatsapp_from is not null;
