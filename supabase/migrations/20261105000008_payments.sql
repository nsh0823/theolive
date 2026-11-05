-- Phase (c) payments (migration 7 in the plan numbering): payments, payment_events, refunds, test_pg.transactions.
-- Clients read a limited set of payment columns; every write is an RPC or an Edge Function with the service role.

create table public.payments (
  -- Also the merchant reference sent to the payment provider.
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null,
  method public.payment_method not null,
  amount integer not null check (amount >= 0),
  status public.payment_status not null default 'READY',
  idempotency_key text not null unique,
  provider_payment_id text,
  failure_code text,
  failure_message text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);
create unique index payments_provider_payment_key on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;
-- One open attempt and one captured attempt per order.
create unique index payments_one_ready_per_order on public.payments (order_id) where status = 'READY';
create unique index payments_one_captured_per_order on public.payments (order_id)
  where status in ('PAID', 'PARTIAL_REFUNDED', 'REFUNDED');
create index payments_ready_requested_idx on public.payments (requested_at) where status = 'READY';

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

-- Every provider callback / confirmation / lookup. The unique (provider, event_id) is the duplicate guard.
create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments (id) on delete restrict,
  provider text not null,
  event_id text not null,
  event_type text not null,
  source text not null check (source in ('CONFIRM', 'WEBHOOK', 'STATUS', 'RECONCILE', 'CHECKOUT')),
  -- Provider payload with card / personal fields stripped by the Edge Function.
  payload jsonb,
  result text not null check (result in ('APPLIED', 'DUPLICATE', 'REJECTED')),
  received_at timestamptz not null default now(),
  constraint payment_events_provider_event_key unique (provider, event_id)
);

create index payment_events_payment_idx on public.payment_events (payment_id);

create trigger payment_events_append_only
  before update or delete on public.payment_events
  for each row execute function private.prevent_update_delete();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount integer not null check (amount > 0),
  reason text not null,
  status public.refund_status not null default 'REQUESTED',
  idempotency_key text not null unique,
  provider_refund_id text,
  requested_by uuid references public.profiles (id) on delete set null,
  failure_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index refunds_payment_idx on public.refunds (payment_id);
create index refunds_requested_by_idx on public.refunds (requested_by);
create index refunds_open_idx on public.refunds (created_at) where status in ('REQUESTED', 'FAILED');

-- The TEST provider's own "database". Stands in for a payment gateway so lookups, webhooks and
-- reconciliation behave like a real provider. Reachable only through the service-role-only test_pg_* functions.
create table test_pg.transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique,
  amount integer not null check (amount >= 0),
  approved_amount integer,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'FAILED', 'CANCELLED', 'REFUNDED')),
  scenario text,
  -- Number of upcoming refund calls that should fail (refund-failure tests).
  refund_failures integer not null default 0 check (refund_failures >= 0),
  refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table test_pg.transactions enable row level security;

revoke all on public.payments, public.payment_events, public.refunds from anon, authenticated;
revoke all on test_pg.transactions from public, anon, authenticated;
-- Column grants hide provider ids, failure internals and idempotency keys from clients.
grant select (id, order_id, provider, method, amount, status, requested_at, approved_at, failed_at, cancelled_at, updated_at)
  on public.payments to authenticated;
grant select (id, payment_id, amount, reason, status, created_at, completed_at)
  on public.refunds to authenticated;

-- A payment is visible to whoever can see its order.
create policy payments_select on public.payments
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- Admins see refunds; customers see the refunds of their own orders. No policy on payment_events.
create policy refunds_select_admin on public.refunds
  for select to authenticated
  using ((select private.is_admin()));
create policy refunds_select_own on public.refunds
  for select to authenticated
  using (exists (
    select 1 from public.payments p
    join public.orders o on o.id = p.order_id
    where p.id = payment_id and o.customer_id = (select auth.uid())
  ));
