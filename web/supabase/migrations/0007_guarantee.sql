-- The profit-or-nothing guarantee, made real.
--
-- Two pieces of state this needs that nothing else in the schema already
-- tracks:
--
--   1. When a gym actually started paying. The free week is casdey's to
--      give and is never charged, so it cannot be the guarantee's clock. The
--      guarantee only starts once real money has changed hands AND a campaign
--      is actually running (see src/lib/guarantee.ts for why both).
--   2. What was actually charged, and through which Stripe payment, so a
--      refund has something concrete to point at. `campaigns.started_at`
--      already gives us the "a campaign is running" half; this migration adds
--      the "money changed hands" half.
--
-- The guarantee window itself (30 days from the first campaign started after
-- the first real payment) is deliberately NOT stored as its own column, for
-- the same reason `effectivePlan` is derived rather than stored in
-- src/lib/plan.ts: a stored window can drift from the campaigns/payments it
-- was computed from. It is derived at read time in src/lib/guarantee-data.ts.
-- The one thing that DOES need to persist is the claim itself, because firing
-- a real refund is a fact, not a computation.

alter table public.gyms
  add column if not exists premium_started_at timestamptz;

comment on column public.gyms.premium_started_at is
  'When the first real (non-trial) Premium payment was collected, set once by the invoice.paid webhook handler and never overwritten. The guarantee clock can only start on or after this date, never during the free week.';

-- ---------------------------------------------------------------------------
-- subscription_payments — what Stripe actually collected, and from what
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_payments (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  gym_id             uuid not null references public.gyms (id) on delete cascade,

  stripe_invoice_id       text not null unique,
  -- Exactly one of these two is set, depending on how Stripe settled the
  -- invoice (see the InvoicePayment.Payment union in the Stripe SDK). Whichever
  -- is set is what a refund is issued against.
  stripe_payment_intent_id text,
  stripe_charge_id         text,

  amount_minor            integer not null check (amount_minor >= 0),
  currency                text not null check (currency in ('gbp','eur')),
  paid_at                 timestamptz not null,

  -- How much of amount_minor has been refunded so far. Tracked here rather
  -- than inferred from guarantee_claims so a payment can never be refunded
  -- twice regardless of how it happens to get refunded.
  refunded_minor          integer not null default 0 check (refunded_minor >= 0)
);

create index if not exists subscription_payments_gym_idx
  on public.subscription_payments (gym_id, paid_at);

alter table public.subscription_payments enable row level security;

create policy subscription_payments_select on public.subscription_payments
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert, update on public.subscription_payments to service_role;
grant select on public.subscription_payments to authenticated;

comment on table public.subscription_payments is
  'One row per successfully paid Stripe invoice. Written by the invoice.paid webhook, never by the application directly. Feeds the guarantee: it is the "what was actually paid" half of profit-or-nothing.';

-- ---------------------------------------------------------------------------
-- guarantee_claims — a refund the guarantee actually paid out
-- ---------------------------------------------------------------------------

create table if not exists public.guarantee_claims (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  gym_id               uuid not null references public.gyms (id) on delete cascade,
  created_by                uuid references auth.users (id) on delete set null,

  window_start              timestamptz not null,
  window_end                timestamptz not null,
  revenue_recovered_minor   integer not null,
  paid_minor                integer not null,
  refunded_minor            integer not null default 0,
  stripe_refund_ids         jsonb not null default '[]'::jsonb,

  status                    text not null default 'processing'
                              check (status in ('processing','refunded','failed')),

  -- One claim per gym, full stop. The guarantee window is derived from
  -- the gym's FIRST paid campaign, so under normal operation there is
  -- only ever one window to claim against; this constraint is also what makes
  -- the self-service claim endpoint safe against a doubled click or a retried
  -- request racing itself; see src/app/api/guarantee/claim/route.ts.
  unique (gym_id)
);

alter table public.guarantee_claims enable row level security;

create policy guarantee_claims_select on public.guarantee_claims
  for select to authenticated
  using (public.is_gym_user(gym_id));

grant select, insert, update on public.guarantee_claims to service_role;
grant select on public.guarantee_claims to authenticated;

comment on table public.guarantee_claims is
  'A profit-or-nothing guarantee claim and its refund. At most one per gym. Written only by src/app/api/guarantee/claim/route.ts.';
