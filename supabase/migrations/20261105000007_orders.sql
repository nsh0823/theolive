-- Phase (c) orders (migration 6 in the plan numbering): orders, order_items, order_status_history, order counters.
-- Orders are written only by security-definer RPCs (create_checkout_order, payment and transition functions).
-- Coupon / point columns exist with zero values so the contract does not change in phases (d) and (e);
-- orders.user_coupon_id and stamp_policy_id are added by the phase (d) migration.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Assigned at PAID so abandoned checkouts leave no gaps (OQ-13).
  order_number text,
  business_date date,
  -- The order survives account deletion (the customer link is cleared).
  customer_id uuid references public.profiles (id) on delete set null,
  client_request_id uuid not null,
  request_hash text not null,
  order_type public.order_type not null,
  status public.order_status not null default 'PENDING_PAYMENT',
  -- Derived cache of the current payment attempt; only the payment functions write it.
  payment_status public.payment_status not null default 'READY',
  payment_method public.payment_method not null,
  note text check (char_length(note) <= 100),
  menu_amount integer not null check (menu_amount >= 0),
  coupon_discount integer not null default 0,
  points_used integer not null default 0 check (points_used >= 0),
  paid_amount integer not null check (paid_amount >= 0),
  reject_reason_code text check (reject_reason_code in ('SOLD_OUT', 'CLOSING', 'TOO_BUSY', 'OTHER')),
  reject_reason text check (char_length(reject_reason) <= 100),
  cancel_reason text check (char_length(cancel_reason) <= 100),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint orders_discount_range check (coupon_discount >= 0 and coupon_discount <= menu_amount),
  constraint orders_paid_amount_formula check (paid_amount = menu_amount - coupon_discount - points_used),
  constraint orders_number_with_date check ((order_number is null) = (business_date is null))
);

create unique index orders_customer_request_key on public.orders (customer_id, client_request_id);
create unique index orders_number_per_day_key on public.orders (business_date, order_number)
  where order_number is not null;
create index orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index orders_status_paid_at_idx on public.orders (status, paid_at);
create index orders_business_date_idx on public.orders (business_date);
create index orders_pending_expiry_idx on public.orders (expires_at) where status = 'PENDING_PAYMENT';

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

-- Snapshot of what was ordered; never changes after insert (PRD 9.2).
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name_snapshot text not null,
  temperature public.temperature,
  quantity integer not null check (quantity between 1 and 20),
  unit_price integer not null check (unit_price >= 0),
  line_total integer generated always as (unit_price * quantity) stored,
  sort_order smallint not null default 0
);

create unique index order_items_line_key on public.order_items (order_id, menu_item_id, temperature);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_menu_item_idx on public.order_items (menu_item_id);

create function private.prevent_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
end;
$$;

create trigger order_items_immutable
  before update on public.order_items
  for each row execute function private.prevent_update();

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.actor_role not null,
  reason text,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);
create index order_status_history_actor_idx on public.order_status_history (actor_id);

create trigger order_status_history_append_only
  before update or delete on public.order_status_history
  for each row execute function private.prevent_update_delete();

-- Internal, no client access: one counter row per KST business day.
create table public.order_number_counters (
  business_date date primary key,
  last_value integer not null
);

create function private.next_order_number(p_business_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.order_number_counters as c (business_date, last_value)
  values (p_business_date, 1)
  on conflict (business_date) do update set last_value = c.last_value + 1
  returning c.last_value into n;
  return 'A-' || n;
end;
$$;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_number_counters enable row level security;

revoke all on public.orders, public.order_items, public.order_status_history,
  public.order_number_counters from anon, authenticated;
grant select on public.orders, public.order_items, public.order_status_history to authenticated;

-- Customers read their own orders of any status. Staff with PROCESS_ORDERS and admins read only orders that
-- were actually paid (PAY-05): unpaid, failed and expired checkouts never reach the store.
create policy orders_select_own on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid()));
create policy orders_select_staff on public.orders
  for select to authenticated
  using (paid_at is not null and (select private.has_staff_permission('PROCESS_ORDERS')));

-- Items and history follow the visibility of their parent order (the sub-select applies the orders policies).
create policy order_items_select on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_status_history_select on public.order_status_history
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
