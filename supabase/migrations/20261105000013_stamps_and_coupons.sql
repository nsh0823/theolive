-- Phase (d) Olive Stamps and reward coupons (migration 11 in the plan numbering).
-- Olive Stamps share no table, balance, ledger or function with Coupon Points (phase e).
-- Approved rules (OQ-23..29): 1 stamp per COMPLETED order (timing fixed), no stamp expiry, one coupon per order
-- (a coupon plus points is allowed), refund reverses the earned stamp and restores a used coupon (as EXPIRED when
-- it has since expired), FREE_ITEM coupons discount the most expensive eligible unit price up to a cap.
-- Writes happen only through security-definer functions; the ledger is append-only.

-- ===== stamp_policies (append-only, versioned) =====
create table public.stamp_policies (
  id uuid primary key default gen_random_uuid(),
  -- Tie-breaker for policies saved in the same instant; the highest version applies.
  version bigint generated always as identity,
  earn_mode public.stamp_earn_mode not null,
  stamps_per_order smallint check (stamps_per_order between 1 and 10),
  amount_per_stamp integer check (amount_per_stamp >= 1000),
  earn_basis text not null default 'MENU_AMOUNT' check (earn_basis in ('MENU_AMOUNT', 'PAID_AMOUNT')),
  -- OQ-24: fixed at COMPLETED. The column stays so a later decision needs no new table.
  earn_timing public.stamp_earn_timing not null default 'COMPLETED' check (earn_timing = 'COMPLETED'),
  effective_from timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stamp_policies_mode_fields check (
    (earn_mode = 'PER_ORDER' and stamps_per_order is not null and amount_per_stamp is null)
    or (earn_mode = 'PER_AMOUNT' and amount_per_stamp is not null and stamps_per_order is null)
  )
);
create index stamp_policies_effective_idx on public.stamp_policies (effective_from desc, version desc);
create index stamp_policies_created_by_idx on public.stamp_policies (created_by);
create trigger stamp_policies_append_only
  before update or delete on public.stamp_policies
  for each row execute function private.prevent_update_delete();

-- A policy must exist from the first day, so the default (1 stamp per order) is part of the schema.
insert into public.stamp_policies (earn_mode, stamps_per_order) values ('PER_ORDER', 1);

create function private.current_stamp_policy()
returns public.stamp_policies
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.stamp_policies p
   where p.effective_from <= now()
   order by p.effective_from desc, p.version desc
   limit 1;
$$;

-- ===== coupons (exchange rules) =====
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 30),
  required_stamps smallint not null check (required_stamps between 1 and 99),
  valid_days smallint not null check (valid_days between 1 and 365),
  benefit_type public.coupon_benefit_type not null,
  -- FIXED_AMOUNT: the won amount off. FREE_ITEM: cap on the free unit price (null = no cap).
  discount_amount integer check (discount_amount > 0 and discount_amount <= 100000),
  -- Both empty = any item. Otherwise a line qualifies by its category or its item id.
  eligible_category_ids uuid[] not null default '{}',
  eligible_menu_item_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_fixed_needs_amount check (benefit_type <> 'FIXED_AMOUNT' or discount_amount is not null)
);
create index coupons_active_idx on public.coupons (is_active, required_stamps);
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function private.set_updated_at();
create trigger coupons_audit
  after insert or update on public.coupons
  for each row execute function private.audit_admin_change('id');

-- ===== user_coupons (issued coupons; the status is mutable, every change is tied to an order or a ledger row) =====
create table public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  title_snapshot text not null,
  benefit_type_snapshot public.coupon_benefit_type not null,
  discount_amount_snapshot integer,
  eligible_category_ids_snapshot uuid[] not null default '{}',
  eligible_menu_item_ids_snapshot uuid[] not null default '{}',
  status public.user_coupon_status not null default 'AVAILABLE',
  issued_at timestamptz not null default now(),
  -- Midnight KST after the last valid day: the coupon works through the whole last day.
  expires_at timestamptz not null,
  reserved_order_id uuid,
  used_order_id uuid,
  used_at timestamptz,
  redeem_transaction_id bigint,
  idempotency_key text not null unique,
  constraint user_coupons_status_fields check (
    (status <> 'RESERVED' or reserved_order_id is not null)
    and (status <> 'USED' or (used_order_id is not null and used_at is not null))
  )
);
create index user_coupons_user_status_idx on public.user_coupons (user_id, status);
create index user_coupons_coupon_idx on public.user_coupons (coupon_id);
create index user_coupons_reserved_order_idx on public.user_coupons (reserved_order_id);
create index user_coupons_used_order_idx on public.user_coupons (used_order_id);
create index user_coupons_redeem_tx_idx on public.user_coupons (redeem_transaction_id);
-- A coupon is held by at most one order at a time.
create unique index user_coupons_one_reservation_per_order
  on public.user_coupons (reserved_order_id) where status = 'RESERVED';
create unique index user_coupons_one_use_per_order
  on public.user_coupons (used_order_id) where status = 'USED';

-- ===== stamp_balances (projection) and stamp_transactions (append-only ledger) =====
create table public.stamp_balances (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.stamp_transactions (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  kind public.stamp_tx_kind not null,
  delta integer not null check (delta <> 0),
  -- Filled by the BEFORE INSERT trigger from the locked balance row.
  balance_after integer not null check (balance_after >= 0),
  order_id uuid references public.orders (id) on delete restrict,
  user_coupon_id uuid references public.user_coupons (id) on delete restrict,
  idempotency_key text not null unique,
  label text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stamp_transactions_delta_sign check (
    (kind in ('EARN', 'REDEEM_RESTORE') and delta > 0)
    or (kind in ('REDEEM', 'EARN_REVERSAL', 'EXPIRE', 'FORFEIT') and delta < 0)
    or kind = 'ADJUST'
  )
);
create index stamp_transactions_user_idx on public.stamp_transactions (user_id, created_at desc);
create index stamp_transactions_order_idx on public.stamp_transactions (order_id);
create index stamp_transactions_coupon_idx on public.stamp_transactions (user_coupon_id);
create index stamp_transactions_actor_idx on public.stamp_transactions (actor_id);

alter table public.user_coupons
  add constraint user_coupons_reserved_order_fkey foreign key (reserved_order_id)
    references public.orders (id) on delete restrict,
  add constraint user_coupons_used_order_fkey foreign key (used_order_id)
    references public.orders (id) on delete restrict,
  add constraint user_coupons_redeem_tx_fkey foreign key (redeem_transaction_id)
    references public.stamp_transactions (id) on delete restrict;

create trigger stamp_transactions_append_only
  before update or delete on public.stamp_transactions
  for each row execute function private.prevent_update_delete();

-- Locks (creating if needed) the member's balance row, rejects a negative result and records balance_after.
-- Because the row lock is held until commit, two concurrent writers for one member are serialized.
create function private.stamp_ledger_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  if new.user_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  insert into public.stamp_balances (user_id, balance) values (new.user_id, 0)
  on conflict (user_id) do nothing;
  select b.balance into v_balance from public.stamp_balances b where b.user_id = new.user_id for update;
  if v_balance + new.delta < 0 then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STAMPS';
  end if;
  new.balance_after := v_balance + new.delta;
  return new;
end;
$$;
create trigger stamp_transactions_balance_before
  before insert on public.stamp_transactions
  for each row execute function private.stamp_ledger_before_insert();

-- The projection moves only after the ledger row really exists (an ON CONFLICT DO NOTHING duplicate never gets here).
create function private.stamp_ledger_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stamp_balances b set balance = new.balance_after, updated_at = now() where b.user_id = new.user_id;
  perform realtime.send(jsonb_build_object('asset', 'STAMP'), 'reward_updated', 'user:' || new.user_id, true);
  return null;
end;
$$;
create trigger stamp_transactions_balance_after
  after insert on public.stamp_transactions
  for each row execute function private.stamp_ledger_after_insert();

create function private.coupon_changed_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    perform realtime.send(jsonb_build_object('asset', 'COUPON'), 'reward_updated', 'user:' || new.user_id, true);
  end if;
  return null;
end;
$$;
create trigger user_coupons_broadcast_insert
  after insert on public.user_coupons
  for each row execute function private.coupon_changed_broadcast();
create trigger user_coupons_broadcast_update
  after update on public.user_coupons
  for each row when (old.status is distinct from new.status)
  execute function private.coupon_changed_broadcast();

-- Adds one ledger row. Returns the new id, or null when the idempotency key already exists (a no-op replay).
create function private.add_stamp_tx(
  p_user_id uuid,
  p_kind public.stamp_tx_kind,
  p_delta integer,
  p_label text,
  p_key text,
  p_order_id uuid default null,
  p_user_coupon_id uuid default null,
  p_actor_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.stamp_transactions (user_id, kind, delta, label, idempotency_key, order_id, user_coupon_id, actor_id)
  values (p_user_id, p_kind, p_delta, p_label, p_key, p_order_id, p_user_coupon_id, p_actor_id)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- ===== orders: coupon and policy links =====
alter table public.orders
  add column user_coupon_id uuid references public.user_coupons (id) on delete restrict,
  add column coupon_title_snapshot text,
  add column stamp_policy_id uuid references public.stamp_policies (id) on delete restrict,
  add constraint orders_discount_needs_coupon check (user_coupon_id is not null or coupon_discount = 0);
create index orders_user_coupon_idx on public.orders (user_coupon_id);
create index orders_stamp_policy_idx on public.orders (stamp_policy_id);

-- ===== row level security =====
alter table public.stamp_policies enable row level security;
alter table public.stamp_balances enable row level security;
alter table public.stamp_transactions enable row level security;
alter table public.coupons enable row level security;
alter table public.user_coupons enable row level security;

revoke all on public.stamp_policies, public.stamp_balances, public.stamp_transactions,
  public.coupons, public.user_coupons from anon, authenticated;
grant select on public.stamp_policies, public.stamp_balances, public.stamp_transactions,
  public.user_coupons to authenticated;
grant select, insert, update on public.coupons to authenticated;

create policy stamp_policies_select on public.stamp_policies
  for select to authenticated using (true);
create policy stamp_balances_select on public.stamp_balances
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy stamp_transactions_select on public.stamp_transactions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy coupons_select on public.coupons
  for select to authenticated using (is_active or (select private.is_admin()));
create policy coupons_admin_insert on public.coupons
  for insert to authenticated with check ((select private.is_admin()));
create policy coupons_admin_update on public.coupons
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy user_coupons_select on public.user_coupons
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- The wallet as the app reads it: an AVAILABLE coupon past its end shows as EXPIRED (a nightly job persists it).
create view public.user_coupon_view with (security_invoker = true) as
  select
    c.id, c.user_id, c.coupon_id, c.title_snapshot, c.benefit_type_snapshot, c.discount_amount_snapshot,
    c.eligible_category_ids_snapshot, c.eligible_menu_item_ids_snapshot,
    case when c.status = 'AVAILABLE' and c.expires_at <= now() then 'EXPIRED'::public.user_coupon_status
         else c.status end as display_status,
    c.issued_at, c.expires_at, c.used_at
  from public.user_coupons c;
revoke all on public.user_coupon_view from anon, authenticated;
grant select on public.user_coupon_view to authenticated;

-- ===== stamp earn / reversal =====
create function private.earn_stamps_for_order(p_order_id uuid, p_to public.order_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.orders;
  pol public.stamp_policies;
  v_count integer;
  v_basis integer;
begin
  select * into ord from public.orders o where o.id = p_order_id;
  if not found or ord.customer_id is null or ord.stamp_policy_id is null then
    return;
  end if;
  select * into pol from public.stamp_policies p where p.id = ord.stamp_policy_id;
  if pol.earn_timing::text <> p_to::text then
    return;
  end if;
  if exists (select 1 from public.profiles pr where pr.id = ord.customer_id and pr.deleted_at is not null) then
    return;
  end if;
  if pol.earn_mode = 'PER_ORDER' then
    v_count := pol.stamps_per_order;
  else
    v_basis := case when pol.earn_basis = 'MENU_AMOUNT' then ord.menu_amount else ord.paid_amount end;
    v_count := v_basis / pol.amount_per_stamp;
  end if;
  -- A zero result writes no row. The key makes a repeated event a no-op.
  if v_count > 0 then
    perform private.add_stamp_tx(ord.customer_id, 'EARN', v_count, '주문 적립', 'earn:' || ord.id, ord.id);
  end if;
end;
$$;

-- Refund success (or a zero-amount order undone): the used coupon comes back, the earned stamps are taken back.
create function private.reverse_order_rewards(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cp public.user_coupons;
  v_user uuid;
  v_earned integer;
  v_balance integer;
  v_reverse integer;
begin
  -- OQ-28: restore with the original expiry; a coupon that ended meanwhile is restored as EXPIRED.
  select * into cp from public.user_coupons c
   where c.used_order_id = p_order_id and c.status = 'USED' for update;
  if found then
    update public.user_coupons c set
      status = case when c.expires_at <= now() then 'EXPIRED'::public.user_coupon_status
                    else 'AVAILABLE'::public.user_coupon_status end,
      used_order_id = null, used_at = null, reserved_order_id = null
     where c.id = cp.id;
  end if;

  -- OQ-29: take back what is still there and log the shortfall when the stamps were already spent.
  select t.user_id, t.delta into v_user, v_earned
    from public.stamp_transactions t where t.idempotency_key = 'earn:' || p_order_id;
  if found and v_user is not null
     and not exists (select 1 from public.stamp_transactions t
                      where t.idempotency_key = 'earn_reversal:' || p_order_id) then
    insert into public.stamp_balances (user_id, balance) values (v_user, 0) on conflict (user_id) do nothing;
    select b.balance into v_balance from public.stamp_balances b where b.user_id = v_user for update;
    v_reverse := least(v_earned, v_balance);
    if v_reverse > 0 then
      perform private.add_stamp_tx(
        v_user, 'EARN_REVERSAL', -v_reverse, '환불로 적립 취소', 'earn_reversal:' || p_order_id, p_order_id);
    end if;
    if v_reverse < v_earned then
      insert into public.admin_audit_log (actor_id, entity, entity_id, action, after)
      values (null, 'stamp_reversal_shortfall', p_order_id::text, 'INSERT',
              jsonb_build_object('userId', v_user, 'earned', v_earned, 'reversed', v_reverse,
                                 'shortfall', v_earned - v_reverse));
    end if;
  end if;
end;
$$;

-- ===== coupon reservation lifecycle (called from private.change_order_status) =====
create function private.use_reserved_coupon(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_coupons c set status = 'USED', used_order_id = p_order_id, used_at = now()
   where c.reserved_order_id = p_order_id and c.status = 'RESERVED';
$$;

create function private.release_reserved_coupon(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_coupons c set status = 'AVAILABLE', reserved_order_id = null
   where c.reserved_order_id = p_order_id and c.status = 'RESERVED';
$$;

-- Every order status change passes here: payment marks a reserved coupon USED and snapshots the stamp policy,
-- a cancelled unpaid order releases its coupon, and the stamp earn fires at the policy's timing.
create or replace function private.change_order_status(
  p_order_id uuid,
  p_to public.order_status,
  p_actor_id uuid,
  p_actor_role public.actor_role,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.order_status;
begin
  select o.status into v_from from public.orders o where o.id = p_order_id;
  update public.orders o set
    status = p_to,
    paid_at = case when p_to = 'PAID' then now() else o.paid_at end,
    accepted_at = case when p_to = 'ACCEPTED' then now() else o.accepted_at end,
    preparing_at = case when p_to = 'PREPARING' then now() else o.preparing_at end,
    ready_at = case when p_to = 'READY' then now() else o.ready_at end,
    completed_at = case when p_to = 'COMPLETED' then now() else o.completed_at end,
    rejected_at = case when p_to = 'REJECTED' then now() else o.rejected_at end,
    cancelled_at = case when p_to = 'CANCELLED' then now() else o.cancelled_at end,
    stamp_policy_id = case when p_to = 'PAID' then (select p.id from private.current_stamp_policy() p)
                           else o.stamp_policy_id end
  where o.id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
  values (p_order_id, v_from, p_to, p_actor_id, p_actor_role, p_reason);

  if p_to = 'PAID' then
    perform private.use_reserved_coupon(p_order_id);
  elsif p_to = 'CANCELLED' and v_from = 'PENDING_PAYMENT' then
    perform private.release_reserved_coupon(p_order_id);
  end if;
  perform private.earn_stamps_for_order(p_order_id, p_to);
end;
$$;

-- A zero-amount paid order has no provider refund, so its rewards are undone right away.
create or replace function private.request_refund(p_payment_id uuid, p_reason text, p_requested_by uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  v_refund_id uuid;
begin
  select * into pay from public.payments p where p.id = p_payment_id;
  if not found or pay.status <> 'PAID' then
    return null;
  end if;
  if pay.amount = 0 then
    perform private.reverse_order_rewards(pay.order_id);
    return null;
  end if;
  insert into public.refunds (payment_id, amount, reason, idempotency_key, requested_by)
  values (pay.id, pay.amount, p_reason, 'refund:' || pay.order_id || ':' || p_reason, p_requested_by)
  on conflict (idempotency_key) do nothing
  returning id into v_refund_id;
  if v_refund_id is null then
    select r.id into v_refund_id from public.refunds r
     where r.idempotency_key = 'refund:' || pay.order_id || ':' || p_reason;
  end if;
  return v_refund_id;
end;
$$;

create or replace function public.record_refund_result(
  p_refund_id uuid,
  p_succeeded boolean,
  p_provider_refund_id text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref public.refunds;
  pay public.payments;
  v_total integer;
  v_status public.payment_status;
begin
  select * into ref from public.refunds r where r.id = p_refund_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into pay from public.payments p where p.id = ref.payment_id for update;
  select * into ref from public.refunds r where r.id = p_refund_id for update;

  if ref.status = 'SUCCEEDED' then
    return jsonb_build_object('refundStatus', ref.status, 'paymentStatus', pay.status);
  end if;

  if p_succeeded then
    update public.refunds r set
      status = 'SUCCEEDED', provider_refund_id = p_provider_refund_id, failure_message = null, completed_at = now()
     where r.id = ref.id;
    select coalesce(sum(r.amount), 0) into v_total
      from public.refunds r where r.payment_id = pay.id and r.status = 'SUCCEEDED';
    v_status := case when v_total >= pay.amount then 'REFUNDED' else 'PARTIAL_REFUNDED' end;
    perform private.set_payment_status(pay.id, v_status);
    -- Only a full refund gives the rewards back (partial refunds have no MVP flow).
    if v_status = 'REFUNDED' then
      perform private.reverse_order_rewards(pay.order_id);
    end if;
    return jsonb_build_object('refundStatus', 'SUCCEEDED', 'paymentStatus', v_status);
  end if;

  update public.refunds r set status = 'FAILED', failure_message = left(p_message, 200) where r.id = ref.id;
  return jsonb_build_object('refundStatus', 'FAILED', 'paymentStatus', pay.status);
end;
$$;

-- ===== coupon pricing =====
-- Locks (optionally) and validates a coupon for the caller. A coupon owned by someone else looks like a missing one.
create function private.lock_usable_coupon(p_uid uuid, p_user_coupon_id uuid, p_lock boolean)
returns public.user_coupons
language plpgsql
security definer
set search_path = ''
as $$
declare
  cp public.user_coupons;
begin
  if p_lock then
    select * into cp from public.user_coupons c
     where c.id = p_user_coupon_id and c.user_id = p_uid for update;
  else
    select * into cp from public.user_coupons c where c.id = p_user_coupon_id and c.user_id = p_uid;
  end if;
  if not found or cp.status in ('RESERVED', 'USED', 'VOID') then
    raise exception using errcode = 'P0001', message = 'COUPON_NOT_USABLE';
  end if;
  if cp.status = 'EXPIRED' or cp.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'COUPON_EXPIRED';
  end if;
  return cp;
end;
$$;

-- OQ-26: FREE_ITEM = unit price of the most expensive eligible line, capped; FIXED_AMOUNT = the fixed won.
-- Never above the menu amount. Null when no line qualifies.
create function private.coupon_discount(p_cp public.user_coupons, p_priced jsonb, p_menu_amount integer)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_top integer;
  v_raw integer;
begin
  select max((e.value ->> 'unit_price')::integer) into v_top
    from jsonb_array_elements(p_priced) e
    join public.menu_items i on i.id = (e.value ->> 'menu_item_id')::uuid
   where (cardinality(p_cp.eligible_category_ids_snapshot) = 0
          and cardinality(p_cp.eligible_menu_item_ids_snapshot) = 0)
      or i.category_id = any (p_cp.eligible_category_ids_snapshot)
      or i.id = any (p_cp.eligible_menu_item_ids_snapshot);
  if v_top is null then
    return null;
  end if;
  v_raw := case p_cp.benefit_type_snapshot
    when 'FIXED_AMOUNT' then p_cp.discount_amount_snapshot
    else least(v_top, coalesce(p_cp.discount_amount_snapshot, v_top))
  end;
  return least(v_raw, p_menu_amount);
end;
$$;

-- Prices cart lines once into the snapshot both the sum and the inserted items use.
create function private.priced_lines_json(p_lines jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'menu_item_id', l.menu_item_id, 'name', l.name, 'temperature', l.temperature,
           'quantity', l.quantity, 'unit_price', l.unit_price, 'position', l.line_position
         ) order by l.line_position), '[]'::jsonb)
    from private.price_lines(p_lines) l;
$$;

create function private.priced_total(p_priced jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((e.value ->> 'unit_price')::integer * (e.value ->> 'quantity')::integer), 0)::integer
    from jsonb_array_elements(p_priced) e;
$$;

-- Read-only price preview (PAY-01, PAY-02): the server returns the discount, the app only shows it.
drop function public.quote_checkout(jsonb);
create function public.quote_checkout(
  p_lines jsonb,
  p_user_coupon_id uuid default null,
  p_points_to_use integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_priced jsonb;
  v_amount integer;
  v_discount integer := 0;
  v_usable jsonb;
  cp public.user_coupons;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  -- Coupon Points arrive in phase (e).
  if coalesce(p_points_to_use, 0) <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  v_priced := private.priced_lines_json(p_lines);
  v_amount := private.priced_total(v_priced);

  if p_user_coupon_id is not null then
    cp := private.lock_usable_coupon(v_uid, p_user_coupon_id, false);
    v_discount := private.coupon_discount(cp, v_priced, v_amount);
    if v_discount is null or v_discount <= 0 then
      raise exception using errcode = 'P0001', message = 'COUPON_NOT_USABLE';
    end if;
  end if;

  select coalesce(jsonb_agg(c.id order by c.expires_at), '[]'::jsonb) into v_usable
    from public.user_coupons c
   where c.user_id = v_uid and c.status = 'AVAILABLE' and c.expires_at > now()
     and coalesce(private.coupon_discount(c, v_priced, v_amount), 0) > 0;

  return jsonb_build_object(
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                'menuItemId', e.value -> 'menu_item_id', 'name', e.value -> 'name',
                'temperature', e.value -> 'temperature', 'quantity', e.value -> 'quantity',
                'unitPrice', e.value -> 'unit_price',
                'lineTotal', (e.value ->> 'unit_price')::integer * (e.value ->> 'quantity')::integer
              ) order by (e.value ->> 'position')::integer), '[]'::jsonb)
              from jsonb_array_elements(v_priced) e),
    'menuAmount', v_amount,
    'couponDiscount', v_discount,
    'pointsUsed', 0,
    'paidAmount', v_amount - v_discount,
    'usableCouponIds', v_usable);
end;
$$;

create or replace function private.checkout_result(p_order_id uuid, p_is_replay boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orderId', o.id,
    'paymentId', p.id,
    'amount', p.amount,
    'menuAmount', o.menu_amount,
    'couponDiscount', o.coupon_discount,
    'pointsUsed', o.points_used,
    'userCouponId', o.user_coupon_id,
    'status', o.status,
    'paymentStatus', o.payment_status,
    'orderNumber', o.order_number,
    'isReplay', p_is_replay
  )
  from public.orders o
  join public.payments p on p.order_id = o.id
  where o.id = p_order_id
  order by p.requested_at desc
  limit 1;
$$;

create or replace function public.create_checkout_order(
  p_client_request_id uuid,
  p_order_type public.order_type,
  p_lines jsonb,
  p_user_coupon_id uuid,
  p_points_to_use integer,
  p_payment_method public.payment_method,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(btrim(p_note), '');
  v_hash text;
  existing public.orders;
  store public.store_settings;
  v_amount integer;
  v_discount integer := 0;
  v_paid integer;
  v_method public.payment_method;
  v_order_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  stale record;
  v_priced jsonb;
  cp public.user_coupons;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if exists (select 1 from public.profiles pr where pr.id = v_uid and pr.deleted_at is not null) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_client_request_id is null or p_order_type is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  if char_length(v_note) > 100 then
    raise exception using errcode = 'P0001', message = 'NOTE_TOO_LONG';
  end if;

  -- Two parallel taps with the same key queue here, so the second one sees the first one's order.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_client_request_id::text, 0));

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'orderType', p_order_type, 'lines', p_lines, 'userCouponId', p_user_coupon_id,
    'pointsToUse', coalesce(p_points_to_use, 0), 'paymentMethod', p_payment_method, 'note', v_note
  )::text, 'utf8'), 'sha256'), 'hex');

  select * into existing from public.orders o
   where o.customer_id = v_uid and o.client_request_id = p_client_request_id;
  if found then
    if existing.request_hash <> v_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return private.checkout_result(existing.id, true);
  end if;

  -- Expiring the caller's stale unpaid orders also releases the coupons they held.
  for stale in
    select o.id from public.orders o
     where o.customer_id = v_uid and o.status = 'PENDING_PAYMENT' and o.expires_at <= now()
  loop
    perform private.expire_order(stale.id);
  end loop;

  select * into store from public.store_settings s where s.id = 1;
  if not store.is_open then
    raise exception using errcode = 'P0001', message = 'STORE_CLOSED';
  end if;
  if not store.is_accepting_orders then
    raise exception using errcode = 'P0001', message = 'NOT_ACCEPTING_ORDERS';
  end if;

  -- Coupon Points arrive in phase (e).
  if coalesce(p_points_to_use, 0) <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  -- Prices are read once; the sum and the inserted items both come from this one snapshot.
  v_priced := private.priced_lines_json(p_lines);
  v_amount := private.priced_total(v_priced);

  -- RW-04 / PAY-02: the coupon row lock makes parallel checkouts with one coupon a race that exactly one wins.
  if p_user_coupon_id is not null then
    cp := private.lock_usable_coupon(v_uid, p_user_coupon_id, true);
    v_discount := private.coupon_discount(cp, v_priced, v_amount);
    if v_discount is null or v_discount <= 0 then
      raise exception using errcode = 'P0001', message = 'COUPON_NOT_USABLE';
    end if;
  end if;
  v_paid := v_amount - v_discount;

  -- Zero-amount orders (OQ-18) need no payment provider.
  v_method := case when v_paid = 0 then 'NONE'::public.payment_method else p_payment_method end;
  if v_method is null or (v_paid > 0 and v_method = 'NONE') then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  insert into public.orders (
    id, customer_id, client_request_id, request_hash, order_type, payment_method, note,
    menu_amount, coupon_discount, paid_amount, user_coupon_id, coupon_title_snapshot, expires_at
  ) values (
    v_order_id, v_uid, p_client_request_id, v_hash, p_order_type, v_method, v_note,
    v_amount, v_discount, v_paid, p_user_coupon_id, cp.title_snapshot,
    now() + make_interval(mins => store.pending_payment_ttl_minutes)
  );
  if p_user_coupon_id is not null then
    update public.user_coupons c set status = 'RESERVED', reserved_order_id = v_order_id where c.id = cp.id;
  end if;
  insert into public.order_items (order_id, menu_item_id, name_snapshot, temperature, quantity, unit_price, sort_order)
  select v_order_id, (e.value ->> 'menu_item_id')::uuid, e.value ->> 'name',
         nullif(e.value ->> 'temperature', '')::public.temperature,
         (e.value ->> 'quantity')::integer, (e.value ->> 'unit_price')::integer,
         (e.value ->> 'position')::integer
    from jsonb_array_elements(v_priced) e;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role)
  values (v_order_id, null, 'PENDING_PAYMENT', v_uid, 'CUSTOMER');
  -- The provider id is a constant until a real gateway is chosen (create or replace this function then).
  insert into public.payments (id, order_id, provider, method, amount, idempotency_key)
  values (v_payment_id, v_order_id, 'TEST', v_method, v_paid, 'checkout:' || v_uid || ':' || p_client_request_id);

  if v_paid = 0 then
    perform private.apply_payment_result(
      v_payment_id, 'APPROVED', 'ZERO-' || v_payment_id, 0, 'zero:' || v_payment_id, 'CHECKOUT');
  end if;

  return private.checkout_result(v_order_id, false);
end;
$$;

-- ===== stamp exchange (RW-02, flow 6.4) =====
-- The whole exchange lives in a private function so the seed and tests can run it for a given member.
create function private.issue_coupon_for_stamps(p_user_id uuid, p_coupon_id uuid, p_client_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'redeem:' || p_user_id || ':' || p_client_request_id;
  def public.coupons;
  existing public.user_coupons;
  v_balance integer;
  v_coupon_id uuid := gen_random_uuid();
  v_tx bigint;
begin
  -- Parallel taps with the same key queue here; the second one finds the first one's coupon.
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into existing from public.user_coupons c where c.idempotency_key = v_key;
  if found then
    if existing.coupon_id <> p_coupon_id then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'userCouponId', existing.id,
      'stampBalance', coalesce((select b.balance from public.stamp_balances b where b.user_id = p_user_id), 0),
      'isReplay', true);
  end if;

  select * into def from public.coupons c where c.id = p_coupon_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if not def.is_active then
    raise exception using errcode = 'P0001', message = 'REWARD_INACTIVE';
  end if;

  insert into public.stamp_balances (user_id, balance) values (p_user_id, 0) on conflict (user_id) do nothing;
  select b.balance into v_balance from public.stamp_balances b where b.user_id = p_user_id for update;
  if v_balance < def.required_stamps then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STAMPS';
  end if;

  insert into public.user_coupons (
    id, user_id, coupon_id, title_snapshot, benefit_type_snapshot, discount_amount_snapshot,
    eligible_category_ids_snapshot, eligible_menu_item_ids_snapshot, expires_at, idempotency_key
  ) values (
    v_coupon_id, p_user_id, def.id, def.title, def.benefit_type, def.discount_amount,
    def.eligible_category_ids, def.eligible_menu_item_ids,
    ((now() at time zone 'Asia/Seoul')::date + def.valid_days + 1)::timestamp at time zone 'Asia/Seoul',
    v_key
  );
  v_tx := private.add_stamp_tx(
    p_user_id, 'REDEEM', -def.required_stamps, '쿠폰 교환', v_key, null, v_coupon_id, p_user_id);
  update public.user_coupons c set redeem_transaction_id = v_tx where c.id = v_coupon_id;

  return jsonb_build_object('userCouponId', v_coupon_id, 'stampBalance', v_balance - def.required_stamps,
                            'isReplay', false);
end;
$$;

create function public.redeem_stamps_for_coupon(p_coupon_id uuid, p_client_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if exists (select 1 from public.profiles pr where pr.id = v_uid and pr.deleted_at is not null) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_coupon_id is null or p_client_request_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  return private.issue_coupon_for_stamps(v_uid, p_coupon_id, p_client_request_id);
end;
$$;

-- ===== admin =====
create function public.admin_set_stamp_policy(
  p_earn_mode public.stamp_earn_mode,
  p_stamps_per_order smallint default 1,
  p_amount_per_stamp integer default null,
  p_earn_basis text default 'MENU_AMOUNT'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pol public.stamp_policies;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  begin
    -- The table checks are the validation; their failure becomes INVALID_INPUT. Timing is not an input (OQ-24).
    insert into public.stamp_policies (earn_mode, stamps_per_order, amount_per_stamp, earn_basis, created_by)
    values (
      p_earn_mode,
      case when p_earn_mode = 'PER_ORDER' then p_stamps_per_order end,
      case when p_earn_mode = 'PER_AMOUNT' then p_amount_per_stamp end,
      coalesce(p_earn_basis, 'MENU_AMOUNT'),
      (select auth.uid()))
    returning * into pol;
  exception when check_violation then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end;
  return to_jsonb(pol);
end;
$$;

create function public.admin_stamp_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return jsonb_build_object(
    'earnedThisMonth', (select coalesce(sum(t.delta), 0) from public.stamp_transactions t
                         where t.kind = 'EARN' and t.created_at >= v_from),
    'exchangedCoupons', (select count(*) from public.user_coupons c where c.issued_at >= v_from),
    'outstandingStamps', (select coalesce(sum(b.balance), 0) from public.stamp_balances b));
end;
$$;

-- ===== nightly expiry of ended coupons (persists what user_coupon_view already shows) =====
create function private.expire_rewards()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.user_coupons c set status = 'EXPIRED' where c.status = 'AVAILABLE' and c.expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;
select cron.schedule('expire-rewards', '5 15 * * *', $$select private.expire_rewards()$$);

-- ===== grants =====
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_admin(), private.is_active_staff(), private.has_staff_permission(public.staff_permission)
to authenticated;

revoke execute on function
  public.quote_checkout(jsonb, uuid, integer),
  public.redeem_stamps_for_coupon(uuid, uuid),
  public.admin_set_stamp_policy(public.stamp_earn_mode, smallint, integer, text),
  public.admin_stamp_overview()
from public, anon, authenticated;
grant execute on function
  public.quote_checkout(jsonb, uuid, integer),
  public.redeem_stamps_for_coupon(uuid, uuid),
  public.admin_set_stamp_policy(public.stamp_earn_mode, smallint, integer, text),
  public.admin_stamp_overview()
to authenticated;
