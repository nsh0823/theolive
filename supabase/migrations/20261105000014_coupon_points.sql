-- Phase (e) Coupon Points (migration 12 in the plan numbering).
-- Coupon Points share no table, balance, ledger, function or enum value with Olive Stamps (phase d). Every
-- object here is named coupon_point_* / *_point_*; the only code that touches both is the display of the two
-- balances next to each other in the app, which reads each from its own table.
-- Approved rules (OQ-30..33): no minimum, 1-won unit, no per-order cap, points may cover 100% of the payable
-- amount; a registered code's points expire with the code (earliest-expiring lot spent first); a refund restores
-- the points to the same lots; codes are issued by admins only (1,000..100,000 won, at most 50 per batch) and only
-- unregistered codes can be voided; 5 failed code entries per 10 minutes per account; no manual adjustments.
-- Writes happen only through security-definer functions; the ledger is append-only.

-- ===== coupon_point_policy (single row) =====
create table public.coupon_point_policy (
  id smallint primary key default 1 check (id = 1),
  min_use_amount integer not null default 0 check (min_use_amount between 0 and 100000),
  use_unit integer not null default 1 check (use_unit between 1 and 10000),
  -- null = no cap per order.
  max_use_per_order integer check (max_use_per_order between 1 and 1000000),
  registration_attempt_limit smallint not null default 5 check (registration_attempt_limit between 1 and 100),
  registration_attempt_window_minutes smallint not null default 10
    check (registration_attempt_window_minutes between 1 and 1440),
  updated_at timestamptz not null default now()
);
insert into public.coupon_point_policy (id) values (1);
create trigger coupon_point_policy_set_updated_at
  before update on public.coupon_point_policy
  for each row execute function private.set_updated_at();
create trigger coupon_point_policy_audit
  after update on public.coupon_point_policy
  for each row execute function private.audit_admin_change('id');

-- ===== batches and codes =====
create table public.coupon_point_code_batches (
  id uuid primary key default gen_random_uuid(),
  amount integer not null check (amount between 1000 and 100000),
  quantity smallint not null check (quantity between 1 and 50),
  expires_at timestamptz not null,
  memo text not null default '' check (char_length(memo) <= 40),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index coupon_point_code_batches_created_by_idx on public.coupon_point_code_batches (created_by);

create table public.coupon_point_codes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.coupon_point_code_batches (id) on delete restrict,
  -- Normalized upper case, OLIVE-XXXX-XXXX. Only admins can read this column; customers register by RPC.
  code text not null unique,
  amount integer not null check (amount between 1000 and 100000),
  expires_at timestamptz not null,
  status public.point_code_status not null default 'UNUSED',
  registered_by uuid references public.profiles (id) on delete set null,
  registered_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint coupon_point_codes_unused_has_no_owner check (status <> 'UNUSED' or registered_by is null),
  constraint coupon_point_codes_registered_has_time check (status <> 'REGISTERED' or registered_at is not null)
);
create index coupon_point_codes_batch_idx on public.coupon_point_codes (batch_id);
create index coupon_point_codes_registered_by_idx on public.coupon_point_codes (registered_by);
create index coupon_point_codes_voided_by_idx on public.coupon_point_codes (voided_by);
create index coupon_point_codes_status_idx on public.coupon_point_codes (status, expires_at);

-- ===== balances (projection) and transactions (append-only ledger) =====
create table public.coupon_point_balances (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.coupon_point_transactions (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  kind public.point_tx_kind not null,
  delta integer not null check (delta <> 0),
  -- Filled by the BEFORE INSERT trigger from the locked balance row.
  balance_after integer not null check (balance_after >= 0),
  -- Every row belongs to one code ("lot"); a USE that spans two lots writes two rows with one key.
  code_id uuid not null references public.coupon_point_codes (id) on delete restrict,
  -- Copied from the code by the trigger so the history can show when these points end.
  lot_expires_at timestamptz not null,
  order_id uuid references public.orders (id) on delete restrict,
  idempotency_key text not null,
  label text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint coupon_point_transactions_key_lot unique (idempotency_key, code_id),
  constraint coupon_point_transactions_delta_sign check (
    (kind in ('REGISTER', 'REFUND_RESTORE') and delta > 0)
    or (kind in ('USE', 'EXPIRE', 'FORFEIT') and delta < 0)
    or kind = 'ADJUST'
  )
);
create index coupon_point_transactions_user_idx on public.coupon_point_transactions (user_id, created_at desc);
create index coupon_point_transactions_code_idx on public.coupon_point_transactions (code_id);
create index coupon_point_transactions_order_idx on public.coupon_point_transactions (order_id);
create index coupon_point_transactions_actor_idx on public.coupon_point_transactions (actor_id);

create trigger coupon_point_transactions_append_only
  before update or delete on public.coupon_point_transactions
  for each row execute function private.prevent_update_delete();

-- Locks (creating if needed) the member's balance row, rejects a negative balance or lot and records balance_after.
-- The row lock is held until commit, so two writers for one member (two checkouts, a restore, an expiry) queue.
create function private.point_ledger_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_lot integer;
begin
  if new.user_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  select c.expires_at into new.lot_expires_at from public.coupon_point_codes c where c.id = new.code_id;
  insert into public.coupon_point_balances (user_id, balance) values (new.user_id, 0)
  on conflict (user_id) do nothing;
  select b.balance into v_balance from public.coupon_point_balances b where b.user_id = new.user_id for update;
  select coalesce(sum(t.delta), 0) into v_lot from public.coupon_point_transactions t where t.code_id = new.code_id;
  if v_balance + new.delta < 0 or v_lot + new.delta < 0 then
    raise exception using errcode = 'P0001', message = 'POINTS_EXCEED_BALANCE';
  end if;
  new.balance_after := v_balance + new.delta;
  return new;
end;
$$;
create trigger coupon_point_transactions_balance_before
  before insert on public.coupon_point_transactions
  for each row execute function private.point_ledger_before_insert();

-- The projection moves only after the ledger row really exists (an ON CONFLICT DO NOTHING duplicate never gets here).
create function private.point_ledger_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.coupon_point_balances b set balance = new.balance_after, updated_at = now()
   where b.user_id = new.user_id;
  perform realtime.send(jsonb_build_object('asset', 'POINT'), 'reward_updated', 'user:' || new.user_id, true);
  return null;
end;
$$;
create trigger coupon_point_transactions_balance_after
  after insert on public.coupon_point_transactions
  for each row execute function private.point_ledger_after_insert();

-- Adds one ledger row. Returns the new id, or null when the key already exists for that lot (a no-op replay).
create function private.add_point_tx(
  p_user_id uuid,
  p_kind public.point_tx_kind,
  p_delta integer,
  p_label text,
  p_key text,
  p_code_id uuid,
  p_order_id uuid default null,
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
  insert into public.coupon_point_transactions
    (user_id, kind, delta, label, idempotency_key, code_id, order_id, actor_id)
  values (p_user_id, p_kind, p_delta, p_label, p_key, p_code_id, p_order_id, p_actor_id)
  on conflict (idempotency_key, code_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- ===== holds (a reservation during checkout; not a ledger and never shown as history) =====
create table public.coupon_point_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  status public.point_hold_status not null default 'HELD',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint coupon_point_holds_resolved check ((status = 'HELD') = (resolved_at is null))
);
create index coupon_point_holds_user_idx on public.coupon_point_holds (user_id, status);

create function private.point_hold_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('asset', 'POINT'), 'reward_updated', 'user:' || new.user_id, true);
  return null;
end;
$$;
create trigger coupon_point_holds_broadcast
  after insert or update on public.coupon_point_holds
  for each row execute function private.point_hold_broadcast();

-- ===== code-entry attempts (brute-force guard; never readable by a client) =====
create table public.coupon_point_code_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index coupon_point_code_attempts_user_idx on public.coupon_point_code_attempts (user_id, created_at desc);

-- ===== row level security =====
alter table public.coupon_point_policy enable row level security;
alter table public.coupon_point_code_batches enable row level security;
alter table public.coupon_point_codes enable row level security;
alter table public.coupon_point_balances enable row level security;
alter table public.coupon_point_transactions enable row level security;
alter table public.coupon_point_holds enable row level security;
alter table public.coupon_point_code_attempts enable row level security;

revoke all on public.coupon_point_policy, public.coupon_point_code_batches, public.coupon_point_codes,
  public.coupon_point_balances, public.coupon_point_transactions, public.coupon_point_holds,
  public.coupon_point_code_attempts from anon, authenticated;
grant select on public.coupon_point_policy, public.coupon_point_code_batches, public.coupon_point_codes,
  public.coupon_point_balances, public.coupon_point_transactions, public.coupon_point_holds to authenticated;
-- Admins change the three use rules only; the brute-force limit is not an admin setting.
grant update (min_use_amount, use_unit, max_use_per_order) on public.coupon_point_policy to authenticated;

create policy coupon_point_policy_select on public.coupon_point_policy
  for select to authenticated using (true);
create policy coupon_point_policy_admin_update on public.coupon_point_policy
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy coupon_point_code_batches_select on public.coupon_point_code_batches
  for select to authenticated using ((select private.is_admin()));
create policy coupon_point_codes_select on public.coupon_point_codes
  for select to authenticated using ((select private.is_admin()));
create policy coupon_point_balances_select on public.coupon_point_balances
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy coupon_point_transactions_select on public.coupon_point_transactions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy coupon_point_holds_select on public.coupon_point_holds
  for select to authenticated using (user_id = (select auth.uid()));

-- ===== helpers =====
create function private.point_policy()
returns public.coupon_point_policy
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.coupon_point_policy p where p.id = 1;
$$;

-- Points that can be spent now: the remainder of every lot whose code has not ended.
create function private.usable_points(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(lot.remaining), 0)::integer
    from (select t.code_id, sum(t.delta) as remaining
            from public.coupon_point_transactions t where t.user_id = p_uid group by t.code_id) lot
    join public.coupon_point_codes c on c.id = lot.code_id
   where c.expires_at > now();
$$;

create function private.held_points(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(h.amount), 0)::integer
    from public.coupon_point_holds h where h.user_id = p_uid and h.status = 'HELD';
$$;

-- Decides how many points an order uses. Strict (checkout): the requested amount must be valid or the matching error
-- is raised. Lenient (quote): the amount is clamped to what is allowed, so the app shows what the server would use.
-- Locking (checkout): the balance row is locked so parallel checkouts of one member cannot overspend.
create function private.price_points(
  p_uid uuid,
  p_requested integer,
  p_payable integer,
  p_strict boolean,
  p_lock boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  pol public.coupon_point_policy;
  v_requested integer := coalesce(p_requested, 0);
  v_available integer;
  v_cap integer;
  v_limit integer;
begin
  if v_requested < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  if v_requested = 0 then
    return 0;
  end if;
  select * into pol from public.coupon_point_policy p where p.id = 1;
  if p_lock then
    insert into public.coupon_point_balances (user_id, balance) values (p_uid, 0) on conflict (user_id) do nothing;
    perform 1 from public.coupon_point_balances b where b.user_id = p_uid for update;
  end if;
  v_available := greatest(private.usable_points(p_uid) - private.held_points(p_uid), 0);
  v_cap := coalesce(pol.max_use_per_order, p_payable);
  v_limit := least(v_available, p_payable, v_cap);
  v_limit := v_limit - (v_limit % pol.use_unit);

  if p_strict then
    if v_requested % pol.use_unit <> 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end if;
    if v_requested > v_available then
      raise exception using errcode = 'P0001', message = 'POINTS_EXCEED_BALANCE';
    end if;
    if v_requested > p_payable or v_requested > v_cap then
      raise exception using errcode = 'P0001', message = 'POINTS_EXCEED_PAYABLE';
    end if;
    if v_requested < pol.min_use_amount then
      raise exception using errcode = 'P0001', message = 'POINTS_BELOW_MINIMUM';
    end if;
    return v_requested;
  end if;

  v_requested := least(v_requested, v_limit);
  return case when v_requested < pol.min_use_amount then 0 else v_requested end;
end;
$$;

-- ===== hold lifecycle (called from private.change_order_status) =====
-- PAID: the held points are spent, earliest-expiring lot first, one ledger row per lot. The key makes a repeat a no-op.
create function private.capture_point_hold(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.coupon_point_holds;
  lot record;
  v_left integer;
  v_take integer;
begin
  select * into h from public.coupon_point_holds x where x.order_id = p_order_id for update;
  if not found or h.status <> 'HELD' then
    return;
  end if;
  insert into public.coupon_point_balances (user_id, balance) values (h.user_id, 0) on conflict (user_id) do nothing;
  perform 1 from public.coupon_point_balances b where b.user_id = h.user_id for update;
  v_left := h.amount;
  -- A lot that ended after the hold was placed is still spendable here: the hold promised these points.
  for lot in
    select t.code_id, sum(t.delta)::integer as remaining
      from public.coupon_point_transactions t
      join public.coupon_point_codes c on c.id = t.code_id
     where t.user_id = h.user_id
     group by t.code_id, c.expires_at
    having sum(t.delta) > 0
     order by c.expires_at, t.code_id
  loop
    exit when v_left = 0;
    v_take := least(lot.remaining, v_left);
    perform private.add_point_tx(
      h.user_id, 'USE', -v_take, '주문 결제', 'use:' || p_order_id, lot.code_id, p_order_id);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception using errcode = 'P0001', message = 'POINTS_EXCEED_BALANCE';
  end if;
  update public.coupon_point_holds x set status = 'CAPTURED', resolved_at = now() where x.id = h.id;
end;
$$;

-- Payment failed, expired or was cancelled before it was paid: nothing was spent, so the ledger is untouched.
create function private.release_point_hold(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.coupon_point_holds h set status = 'RELEASED', resolved_at = now()
   where h.order_id = p_order_id and h.status = 'HELD';
$$;

-- Refund of a paid order: every USE row of the order is given back to the same lot. Keyed per order and lot.
create function private.restore_points_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u record;
begin
  for u in
    select t.user_id, t.code_id, -t.delta as amount
      from public.coupon_point_transactions t
     where t.order_id = p_order_id and t.kind = 'USE'
     order by t.id
  loop
    perform private.add_point_tx(
      u.user_id, 'REFUND_RESTORE', u.amount, '환불로 포인트 복구', 'refund_restore:' || p_order_id,
      u.code_id, p_order_id);
  end loop;
end;
$$;

-- ===== order status changes: capture on PAID, release on an unpaid cancellation =====
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
    perform private.capture_point_hold(p_order_id);
  elsif p_to = 'CANCELLED' and v_from = 'PENDING_PAYMENT' then
    perform private.release_reserved_coupon(p_order_id);
    perform private.release_point_hold(p_order_id);
  end if;
  perform private.earn_stamps_for_order(p_order_id, p_to);
end;
$$;

-- Refund success (or a zero-amount order undone): the used coupon comes back, the earned stamps are taken back, and
-- the spent Coupon Points return to their lots. The three assets are handled by separate statements and tables.
create or replace function private.reverse_order_rewards(p_order_id uuid)
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

  -- OQ-30: the points go back to the same lots; a lot that ended meanwhile is expired again by the nightly job.
  perform private.restore_points_for_order(p_order_id);
end;
$$;

-- ===== checkout pricing with points =====
create or replace function public.quote_checkout(
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
  v_points integer;
  v_usable jsonb;
  cp public.user_coupons;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
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

  -- The server decides how many points apply; the app shows the answer and never computes a total itself.
  v_points := private.price_points(v_uid, p_points_to_use, v_amount - v_discount, false, false);

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
    'pointsUsed', v_points,
    'paidAmount', v_amount - v_discount - v_points,
    'usableCouponIds', v_usable,
    'pointsAvailable', greatest(private.usable_points(v_uid) - private.held_points(v_uid), 0),
    -- What "use all" would apply for this cart and coupon.
    'maxPointsUsable', private.price_points(v_uid, v_amount - v_discount, v_amount - v_discount, false, false));
end;
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
  v_points integer := 0;
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

  -- Expiring the caller's stale unpaid orders also releases the coupons and point holds they kept.
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

  -- RW-07 / PAY-03: the balance row lock plus the open holds make parallel checkouts unable to overspend. The coupon
  -- lock is always taken first, so a payment settling at the same time (coupon, then points) cannot deadlock.
  v_points := private.price_points(v_uid, p_points_to_use, v_amount - v_discount, true, true);
  v_paid := v_amount - v_discount - v_points;

  -- Zero-amount orders (OQ-18) need no payment provider.
  v_method := case when v_paid = 0 then 'NONE'::public.payment_method else p_payment_method end;
  if v_method is null or (v_paid > 0 and v_method = 'NONE') then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  insert into public.orders (
    id, customer_id, client_request_id, request_hash, order_type, payment_method, note,
    menu_amount, coupon_discount, points_used, paid_amount, user_coupon_id, coupon_title_snapshot, expires_at
  ) values (
    v_order_id, v_uid, p_client_request_id, v_hash, p_order_type, v_method, v_note,
    v_amount, v_discount, v_points, v_paid, p_user_coupon_id, cp.title_snapshot,
    now() + make_interval(mins => store.pending_payment_ttl_minutes)
  );
  if p_user_coupon_id is not null then
    update public.user_coupons c set status = 'RESERVED', reserved_order_id = v_order_id where c.id = cp.id;
  end if;
  if v_points > 0 then
    insert into public.coupon_point_holds (order_id, user_id, amount) values (v_order_id, v_uid, v_points);
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

-- ===== customer RPCs =====
-- RW-05..08: registration. A rejected entry is RETURNED (not raised) so the failed attempt is committed and counts
-- toward the limit; a raised error would roll the attempt back. The app turns `errorCode` into an error.
create function private.register_point_code(p_user_id uuid, p_raw text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pol public.coupon_point_policy;
  v_code text := upper(regexp_replace(coalesce(p_raw, ''), '\s', '', 'g'));
  v_failures integer;
  v_oldest timestamptz;
  v_window interval;
  cd public.coupon_point_codes;
  v_error text;
begin
  select * into pol from public.coupon_point_policy p where p.id = 1;
  v_window := make_interval(mins => pol.registration_attempt_window_minutes);
  -- Parallel guesses of one member queue here, so the limit cannot be beaten by firing them at once.
  perform pg_advisory_xact_lock(hashtextextended('point-attempts:' || p_user_id, 0));

  select count(*), min(a.created_at) into v_failures, v_oldest
    from public.coupon_point_code_attempts a
   where a.user_id = p_user_id and not a.succeeded and a.created_at > now() - v_window;
  if v_failures >= pol.registration_attempt_limit then
    -- A blocked call is not recorded, so the lock ends when the oldest failure leaves the window.
    return jsonb_build_object(
      'status', 'REJECTED', 'errorCode', 'TOO_MANY_ATTEMPTS',
      'retryAfterSeconds', greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer));
  end if;

  -- OLIVEABCD1234 is accepted as OLIVE-ABCD-1234.
  if v_code ~ '^OLIVE[A-Z0-9]{8}$' then
    v_code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 4) || '-' || substr(v_code, 10, 4);
  end if;
  if v_code !~ '^OLIVE-[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    v_error := 'CODE_INVALID';
  else
    -- The row lock makes a second member registering the same code wait, then see it registered.
    select * into cd from public.coupon_point_codes c where c.code = v_code for update;
    if not found then
      v_error := 'CODE_INVALID';
    elsif cd.status = 'VOID' then
      v_error := 'CODE_VOID';
    elsif cd.status = 'REGISTERED' then
      v_error := 'CODE_ALREADY_REGISTERED';
    elsif cd.status = 'EXPIRED' or cd.expires_at <= now() then
      v_error := 'CODE_EXPIRED';
    end if;
  end if;

  if v_error is not null then
    insert into public.coupon_point_code_attempts (user_id, succeeded) values (p_user_id, false);
    return jsonb_build_object('status', 'REJECTED', 'errorCode', v_error);
  end if;

  update public.coupon_point_codes c set
    status = 'REGISTERED', registered_by = p_user_id, registered_at = now()
   where c.id = cd.id;
  insert into public.coupon_point_code_attempts (user_id, succeeded) values (p_user_id, true);
  perform private.add_point_tx(p_user_id, 'REGISTER', cd.amount, '코드 등록', 'register:' || cd.id, cd.id);
  return jsonb_build_object(
    'status', 'REGISTERED', 'amount', cd.amount, 'expiresAt', cd.expires_at,
    'balance', private.usable_points(p_user_id));
end;
$$;

create function public.register_coupon_point_code(p_code text)
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
  return private.register_point_code(v_uid, p_code);
end;
$$;

-- The balance the app shows: spendable points (lots that have not ended) and what is left after open checkouts.
create function public.get_my_point_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_usable integer;
  v_held integer;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  v_usable := private.usable_points(v_uid);
  v_held := private.held_points(v_uid);
  return jsonb_build_object(
    'balance', v_usable,
    'held', v_held,
    'available', greatest(v_usable - v_held, 0),
    -- The next date points end, so the screen can warn before they disappear.
    'nextExpiresAt', (select min(c.expires_at)
                        from (select t.code_id from public.coupon_point_transactions t
                               where t.user_id = v_uid group by t.code_id having sum(t.delta) > 0) lot
                        join public.coupon_point_codes c on c.id = lot.code_id
                       where c.expires_at > now()));
end;
$$;

-- ===== admin =====
create function private.generate_point_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- 32 characters, no 0/O/1/I. 256 is a multiple of 32, so a random byte maps to a character without bias.
  c_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_chars text := '';
  i integer;
begin
  for i in 0..7 loop
    v_chars := v_chars || substr(c_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return 'OLIVE-' || substr(v_chars, 1, 4) || '-' || substr(v_chars, 5, 4);
end;
$$;

-- Codes are returned here once. Later reads (admin_list_point_codes) show them masked.
create function public.admin_issue_point_codes(
  p_amount integer,
  p_quantity integer,
  p_expires_on date,
  p_memo text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_memo text := btrim(coalesce(p_memo, ''));
  v_batch_id uuid := gen_random_uuid();
  v_expires timestamptz;
  v_codes jsonb := '[]'::jsonb;
  v_id uuid;
  v_code text;
  v_tries integer := 0;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_amount is null or p_amount not between 1000 and 100000
     or p_quantity is null or p_quantity not between 1 and 50
     or p_expires_on is null or p_expires_on <= (now() at time zone 'Asia/Seoul')::date
     or char_length(v_memo) > 40 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  -- The code works through the whole last day (midnight KST after it), like reward coupons.
  v_expires := (p_expires_on + 1)::timestamp at time zone 'Asia/Seoul';

  insert into public.coupon_point_code_batches (id, amount, quantity, expires_at, memo, created_by)
  values (v_batch_id, p_amount, p_quantity, v_expires, v_memo, v_uid);

  while jsonb_array_length(v_codes) < p_quantity loop
    v_tries := v_tries + 1;
    if v_tries > p_quantity * 20 then
      raise exception using errcode = 'P0001', message = 'INTERNAL';
    end if;
    insert into public.coupon_point_codes (batch_id, code, amount, expires_at)
    values (v_batch_id, private.generate_point_code(), p_amount, v_expires)
    on conflict (code) do nothing
    returning id, code into v_id, v_code;
    if v_id is not null then
      v_codes := v_codes || jsonb_build_object('id', v_id, 'code', v_code);
      v_id := null;
    end if;
  end loop;

  insert into public.admin_audit_log (actor_id, entity, entity_id, action, after)
  values (v_uid, 'coupon_point_code_batches', v_batch_id::text, 'INSERT',
          jsonb_build_object('amount', p_amount, 'quantity', p_quantity, 'expiresAt', v_expires, 'memo', v_memo));
  return jsonb_build_object('batchId', v_batch_id, 'codes', v_codes);
end;
$$;

-- OQ-31: only a code nobody registered can be voided.
create function public.admin_void_point_code(p_code_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  cd public.coupon_point_codes;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  select * into cd from public.coupon_point_codes c where c.id = p_code_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if cd.status = 'REGISTERED' then
    raise exception using errcode = 'P0001', message = 'CODE_ALREADY_REGISTERED';
  end if;
  if cd.status = 'VOID' then
    return jsonb_build_object('status', 'VOID');
  end if;
  update public.coupon_point_codes c set status = 'VOID', voided_at = now(), voided_by = v_uid where c.id = cd.id;
  insert into public.admin_audit_log (actor_id, entity, entity_id, action, after)
  values (v_uid, 'coupon_point_codes', cd.id::text, 'UPDATE', jsonb_build_object('status', 'VOID'));
  return jsonb_build_object('status', 'VOID');
end;
$$;

-- Display status: VOID, EXPIRED (ended), EXHAUSTED (registered, nothing left), REGISTERED, UNUSED.
-- `remaining` is what a customer could still spend from the code (0 once the code ended).
create function private.point_code_rows()
returns table (
  id uuid, code text, amount integer, expires_at timestamptz, created_at timestamptz,
  registered_at timestamptz, memo text, batch_id uuid, net_used integer, remaining integer, display_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.code, c.amount, c.expires_at, c.created_at, c.registered_at, b.memo, b.id,
    l.net_used,
    case when c.status = 'REGISTERED' and c.expires_at > now() then l.ledger else 0 end,
    case
      when c.status = 'VOID' then 'VOID'
      when c.expires_at <= now() or c.status = 'EXPIRED' then 'EXPIRED'
      when c.status = 'REGISTERED' and l.ledger = 0 then 'EXHAUSTED'
      else c.status::text
    end
  from public.coupon_point_codes c
  join public.coupon_point_code_batches b on b.id = c.batch_id
  cross join lateral (
    select coalesce(sum(t.delta), 0)::integer as ledger,
           coalesce(-sum(t.delta) filter (where t.kind in ('USE', 'REFUND_RESTORE')), 0)::integer as net_used
      from public.coupon_point_transactions t where t.code_id = c.id) l;
$$;

create function public.admin_list_point_codes(
  p_status text default null,
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := upper(regexp_replace(coalesce(p_search, ''), '\s', '', 'g'));
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_rows jsonb;
  v_totals jsonb;
  v_matching integer;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_status is not null and p_status not in ('UNUSED', 'REGISTERED', 'EXHAUSTED', 'EXPIRED', 'VOID') then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id,
           -- Only the last four characters are shown after the issue screen; the full code is not listed again.
           'maskedCode', 'OLIVE-••••-' || right(x.code, 4),
           'amount', x.amount, 'remaining', x.remaining, 'status', x.display_status,
           'issuedAt', x.created_at, 'expiresAt', x.expires_at, 'registeredAt', x.registered_at,
           'memo', x.memo, 'batchId', x.batch_id
         ) order by x.created_at desc, x.id), '[]'::jsonb) into v_rows
    from (select v.* from private.point_code_rows() v
           where (p_status is null or v.display_status = p_status)
             and (v_search = '' or v.code = v_search or v.memo ilike '%' || btrim(p_search) || '%')
           order by v.created_at desc, v.id
           limit v_limit offset v_offset) x;

  -- How many codes match the filter and search (for paging); the totals below always cover every code.
  select count(*) into v_matching from private.point_code_rows() v
   where (p_status is null or v.display_status = p_status)
     and (v_search = '' or v.code = v_search or v.memo ilike '%' || btrim(p_search) || '%');

  select jsonb_build_object(
           'issued', coalesce(sum(v.amount) filter (where v.display_status <> 'VOID'), 0),
           'used', coalesce(sum(v.net_used), 0),
           'remaining', coalesce(sum(v.remaining), 0))
    into v_totals from private.point_code_rows() v;

  return jsonb_build_object('codes', v_rows, 'matching', v_matching, 'totals', v_totals);
end;
$$;

-- ===== nightly expiry =====
-- Unused codes past their end are marked EXPIRED; registered points past their end get an EXPIRE row for the rest of
-- the lot (key includes the lot's last ledger id, so points restored later by a refund expire once more). A member
-- with an open checkout is skipped until the next run, so a held amount can always be captured.
create or replace function private.expire_rewards()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  total integer := 0;
  lot record;
begin
  update public.user_coupons c set status = 'EXPIRED' where c.status = 'AVAILABLE' and c.expires_at <= now();
  get diagnostics n = row_count;
  total := total + n;

  update public.coupon_point_codes c set status = 'EXPIRED' where c.status = 'UNUSED' and c.expires_at <= now();
  get diagnostics n = row_count;
  total := total + n;

  for lot in
    select t.user_id, t.code_id, sum(t.delta)::integer as remaining, max(t.id) as last_id
      from public.coupon_point_transactions t
      join public.coupon_point_codes c on c.id = t.code_id
     where c.status = 'REGISTERED' and c.expires_at <= now() and t.user_id is not null
       and not exists (select 1 from public.coupon_point_holds h where h.user_id = t.user_id and h.status = 'HELD')
     group by t.user_id, t.code_id
    having sum(t.delta) > 0
  loop
    perform private.add_point_tx(
      lot.user_id, 'EXPIRE', -lot.remaining, '포인트 소멸', 'expire:' || lot.code_id || ':' || lot.last_id,
      lot.code_id);
    total := total + 1;
  end loop;
  return total;
end;
$$;

-- ===== grants =====
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_admin(), private.is_active_staff(), private.has_staff_permission(public.staff_permission)
to authenticated;

revoke execute on function
  public.quote_checkout(jsonb, uuid, integer),
  public.register_coupon_point_code(text),
  public.get_my_point_summary(),
  public.admin_issue_point_codes(integer, integer, date, text),
  public.admin_void_point_code(uuid),
  public.admin_list_point_codes(text, text, integer, integer)
from public, anon, authenticated;
grant execute on function
  public.quote_checkout(jsonb, uuid, integer),
  public.register_coupon_point_code(text),
  public.get_my_point_summary(),
  public.admin_issue_point_codes(integer, integer, date, text),
  public.admin_void_point_code(uuid),
  public.admin_list_point_codes(text, text, integer, integer)
to authenticated;
