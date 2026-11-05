-- Phase (c) order and payment functions (migration 8 in the plan numbering).
-- All money and state changes live here. Clients never send prices or statuses: totals are recomputed from
-- menu_items, and every payment result passes through private.apply_payment_result (the single place a payment
-- changes state). Lock order everywhere: payments row first, then orders row (prevents deadlocks).
-- Coupons and points are not part of this phase: create_checkout_order rejects them until phases (d) and (e).

-- ===== internal helpers =====

create function private.lock_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.orders;
begin
  perform 1 from public.payments p where p.order_id = p_order_id for update;
  select * into ord from public.orders o where o.id = p_order_id for update;
  return ord;
end;
$$;

-- Moves an order to a new status, stamps the matching timestamp and writes the history row, atomically.
create function private.change_order_status(
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
    cancelled_at = case when p_to = 'CANCELLED' then now() else o.cancelled_at end
  where o.id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, reason)
  values (p_order_id, v_from, p_to, p_actor_id, p_actor_role, p_reason);
end;
$$;

-- Changes a payment's status and mirrors it to orders.payment_status in the same transaction.
create function private.set_payment_status(
  p_payment_id uuid,
  p_status public.payment_status,
  p_failure_code text default null,
  p_failure_message text default null,
  p_provider_payment_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  update public.payments p set
    status = p_status,
    provider_payment_id = coalesce(p_provider_payment_id, p.provider_payment_id),
    failure_code = coalesce(p_failure_code, p.failure_code),
    failure_message = coalesce(p_failure_message, p.failure_message),
    approved_at = case when p_status = 'PAID' then now() else p.approved_at end,
    failed_at = case when p_status = 'FAILED' then now() else p.failed_at end,
    cancelled_at = case when p_status = 'CANCELLED' then now() else p.cancelled_at end
  where p.id = p_payment_id
  returning p.order_id into v_order_id;
  update public.orders o set payment_status = p_status where o.id = v_order_id;
end;
$$;

-- Records a full-refund request for a captured payment. Idempotent per (order, reason). Returns null when
-- there is nothing to refund (zero-amount payment or not captured).
create function private.request_refund(p_payment_id uuid, p_reason text, p_requested_by uuid)
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
  if not found or pay.status <> 'PAID' or pay.amount = 0 then
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

create function private.payment_summary(
  p_payment_id uuid,
  p_result text,
  p_refund_id uuid,
  p_cancel_at_provider boolean
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'result', p_result,
    'paymentId', p.id,
    'orderId', o.id,
    'orderStatus', o.status,
    'paymentStatus', p.status,
    'orderNumber', o.order_number,
    'amount', p.amount,
    'providerPaymentId', p.provider_payment_id,
    'refundId', p_refund_id,
    'cancelAtProvider', p_cancel_at_provider
  )
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = p_payment_id;
$$;

-- The single place a payment changes state (plan section 3.3). Idempotent: the (provider, event_id) guard and
-- the state checks make a repeated confirm / webhook / lookup a no-op that reports DUPLICATE.
create function private.apply_payment_result(
  p_payment_id uuid,
  p_outcome text,
  p_provider_payment_id text,
  p_amount integer,
  p_event_id text,
  p_source text,
  p_payload jsonb default null,
  p_failure_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  ord public.orders;
  v_result text := 'DUPLICATE';
  v_refund_id uuid;
  v_cancel_at_provider boolean := false;
  v_date date;
begin
  if p_outcome not in ('APPROVED', 'FAILED', 'CANCELLED') or p_event_id is null or p_source is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  select * into pay from public.payments p where p.id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into ord from public.orders o where o.id = pay.order_id for update;

  if exists (select 1 from public.payment_events e where e.provider = pay.provider and e.event_id = p_event_id) then
    return private.payment_summary(pay.id, 'DUPLICATE', null, false);
  end if;

  if p_outcome = 'APPROVED' then
    -- A cancelled attempt (expired or cancelled by the customer) can still receive an approval: the money was
    -- taken, so it is recorded and refunded below.
    if pay.status = 'READY'
       or (pay.status = 'CANCELLED' and pay.failure_code in ('EXPIRED', 'CUSTOMER_CANCELLED')) then
      if p_amount is distinct from pay.amount then
        if pay.status = 'READY' then
          perform private.set_payment_status(
            pay.id, 'FAILED', 'AMOUNT_MISMATCH', '승인 금액이 주문 금액과 달라요.', p_provider_payment_id);
          if ord.status = 'PENDING_PAYMENT' then
            perform private.change_order_status(ord.id, 'CANCELLED', null, 'SYSTEM', 'AMOUNT_MISMATCH');
            update public.orders o set cancel_reason = 'AMOUNT_MISMATCH' where o.id = ord.id;
          end if;
        end if;
        v_result := 'REJECTED';
        v_cancel_at_provider := true;
      elsif pay.status = 'READY' and ord.status = 'PENDING_PAYMENT' then
        perform private.set_payment_status(pay.id, 'PAID', null, null, p_provider_payment_id);
        perform private.change_order_status(ord.id, 'PAID', null, 'SYSTEM', null);
        v_date := (now() at time zone 'Asia/Seoul')::date;
        update public.orders o set order_number = private.next_order_number(v_date), business_date = v_date
         where o.id = ord.id;
        v_result := 'APPLIED';
      else
        perform private.set_payment_status(pay.id, 'PAID', null, null, p_provider_payment_id);
        v_refund_id := private.request_refund(pay.id, 'LATE_APPROVAL', null);
        v_result := 'APPLIED';
      end if;
    end if;
  elsif pay.status = 'READY' then
    perform private.set_payment_status(
      pay.id, p_outcome::public.payment_status, coalesce(p_failure_code, p_outcome), null, p_provider_payment_id);
    if ord.status = 'PENDING_PAYMENT' then
      perform private.change_order_status(ord.id, 'CANCELLED', null, 'SYSTEM', 'PAYMENT_' || p_outcome);
      update public.orders o set cancel_reason = 'PAYMENT_' || p_outcome where o.id = ord.id;
    end if;
    v_result := 'APPLIED';
  end if;

  insert into public.payment_events (payment_id, provider, event_id, event_type, source, payload, result)
  values (pay.id, pay.provider, p_event_id, p_outcome, p_source, p_payload, v_result)
  on conflict (provider, event_id) do nothing;

  return private.payment_summary(pay.id, v_result, v_refund_id, v_cancel_at_provider);
end;
$$;

-- Cancels an unpaid order whose lifetime ended (OQ-14). Never touches an order whose payment is not READY.
create function private.expire_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.orders;
  v_payment_id uuid;
begin
  ord := private.lock_order(p_order_id);
  if ord.id is null or ord.status <> 'PENDING_PAYMENT' or ord.expires_at > now()
     or ord.payment_status <> 'READY' then
    return false;
  end if;
  select p.id into v_payment_id from public.payments p where p.order_id = ord.id and p.status = 'READY';
  if v_payment_id is not null then
    perform private.set_payment_status(v_payment_id, 'CANCELLED', 'EXPIRED', '결제 시간이 지났어요.');
  end if;
  perform private.change_order_status(ord.id, 'CANCELLED', null, 'SYSTEM', 'EXPIRED');
  update public.orders o set cancel_reason = 'EXPIRED' where o.id = ord.id;
  return true;
end;
$$;

create function private.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select o.id from public.orders o
     where o.status = 'PENDING_PAYMENT' and o.expires_at <= now() and o.payment_status = 'READY'
     order by o.expires_at
     limit 500
  loop
    if private.expire_order(r.id) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- ===== service-role entry points (Edge Functions) =====

create function public.apply_payment_result(
  p_payment_id uuid,
  p_outcome text,
  p_provider_payment_id text,
  p_amount integer,
  p_event_id text,
  p_source text,
  p_payload jsonb default null,
  p_failure_code text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_payment_result(
    p_payment_id, p_outcome, p_provider_payment_id, p_amount, p_event_id, p_source, p_payload, p_failure_code);
$$;

-- Records what the provider answered to a refund call. Idempotent: a refund that already succeeded is left alone.
create function public.record_refund_result(
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
    return jsonb_build_object('refundStatus', 'SUCCEEDED', 'paymentStatus', v_status);
  end if;

  update public.refunds r set status = 'FAILED', failure_message = left(p_message, 200) where r.id = ref.id;
  return jsonb_build_object('refundStatus', 'FAILED', 'paymentStatus', pay.status);
end;
$$;

create function public.expire_stale_orders()
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.expire_stale_orders();
$$;

-- TEST provider only: its fake "gateway database" (test_pg.transactions). Service role only.
create function public.test_pg_create(p_payment_id uuid, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  txn test_pg.transactions;
begin
  insert into test_pg.transactions (payment_id, amount) values (p_payment_id, p_amount)
  on conflict (payment_id) do nothing;
  select * into txn from test_pg.transactions t where t.payment_id = p_payment_id;
  return to_jsonb(txn);
end;
$$;

create function public.test_pg_get(p_payment_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select to_jsonb(t) from test_pg.transactions t where t.payment_id = p_payment_id;
$$;

create function public.test_pg_set(
  p_payment_id uuid,
  p_status text,
  p_scenario text default null,
  p_approved_amount integer default null,
  p_refund_failures integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  txn test_pg.transactions;
begin
  update test_pg.transactions t set
    status = coalesce(p_status, t.status),
    scenario = coalesce(p_scenario, t.scenario),
    approved_amount = coalesce(p_approved_amount, t.approved_amount),
    refund_failures = coalesce(p_refund_failures, t.refund_failures),
    updated_at = now()
   where t.payment_id = p_payment_id
   returning * into txn;
  return to_jsonb(txn);
end;
$$;

-- Refund call of the TEST gateway: idempotent per key, can be told to fail a number of times.
create function public.test_pg_refund(p_provider_payment_id text, p_amount integer, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  txn test_pg.transactions;
begin
  select * into txn from test_pg.transactions t where t.id::text = p_provider_payment_id for update;
  if not found then
    return jsonb_build_object('status', 'FAILED', 'message', 'UNKNOWN_TRANSACTION');
  end if;
  if txn.status = 'REFUNDED' then
    return jsonb_build_object('status', 'SUCCEEDED', 'providerRefundId', txn.refund_id);
  end if;
  if txn.refund_failures > 0 then
    update test_pg.transactions t set refund_failures = t.refund_failures - 1, updated_at = now()
     where t.id = txn.id;
    return jsonb_build_object('status', 'FAILED', 'message', 'TEST_REFUND_FAILURE');
  end if;
  update test_pg.transactions t set status = 'REFUNDED', refund_id = 'test-refund-' || p_idempotency_key,
    updated_at = now() where t.id = txn.id;
  return jsonb_build_object('status', 'SUCCEEDED', 'providerRefundId', 'test-refund-' || p_idempotency_key);
end;
$$;

-- SUCCESS_LATE scenario: makes the order's lifetime end now so the following approval arrives "late".
create function public.test_pg_force_expire(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  select p.order_id into v_order_id from public.payments p where p.id = p_payment_id;
  update public.orders o set expires_at = now() - interval '1 second' where o.id = v_order_id;
  return private.expire_order(v_order_id);
end;
$$;

-- ===== customer RPCs =====

-- Validates and prices cart lines from menu_items. Raises the first problem found.
-- Returns merged lines (same item + temperature added together) in first-seen order.
create function private.price_lines(p_lines jsonb)
returns table (
  menu_item_id uuid,
  name text,
  temperature public.temperature,
  quantity integer,
  unit_price integer,
  line_position integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  line record;
  item record;
  v_id uuid;
  v_temp public.temperature;
  v_qty integer;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_lines) > 30 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  for line in select e.value from jsonb_array_elements(p_lines) as e loop
    if jsonb_typeof(line.value) <> 'object' then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end if;
    begin
      v_id := (line.value ->> 'menuItemId')::uuid;
      v_temp := nullif(line.value ->> 'temperature', '')::public.temperature;
      v_qty := (line.value ->> 'quantity')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end;
    if v_id is null or v_qty is null then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end if;
    if v_qty < 1 or v_qty > 20 then
      raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
    end if;

    select i.id, i.is_sold_out, i.temperatures into item
      from public.menu_items i
      join public.menu_categories c on c.id = i.category_id
     where i.id = v_id and i.archived_at is null and i.is_active and c.is_active;
    if not found then
      raise exception using errcode = 'P0001', message = 'ITEM_UNAVAILABLE';
    end if;
    if item.is_sold_out then
      raise exception using errcode = 'P0001', message = 'ITEM_SOLD_OUT';
    end if;
    if cardinality(item.temperatures) = 0 then
      if v_temp is not null then
        raise exception using errcode = 'P0001', message = 'INVALID_TEMPERATURE';
      end if;
    elsif v_temp is null or not (v_temp = any (item.temperatures)) then
      raise exception using errcode = 'P0001', message = 'INVALID_TEMPERATURE';
    end if;
  end loop;

  if exists (
    select 1
      from jsonb_array_elements(p_lines) as e
     group by e.value ->> 'menuItemId', nullif(e.value ->> 'temperature', '')
    having sum((e.value ->> 'quantity')::integer) > 20
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;

  return query
    select i.id, i.name, m.temp, m.qty::integer, i.price, m.first_position::integer
      from (
        select (e.value ->> 'menuItemId')::uuid as item_id,
               nullif(e.value ->> 'temperature', '')::public.temperature as temp,
               sum((e.value ->> 'quantity')::integer) as qty,
               min(e.ordinality) as first_position
          from jsonb_array_elements(p_lines) with ordinality as e
         group by 1, 2
      ) m
      join public.menu_items i on i.id = m.item_id
     order by m.first_position;
end;
$$;

-- Read-only price preview (PAY-01). The checkout Edge Function and create_checkout_order recompute everything.
create function public.quote_checkout(p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lines jsonb;
  v_amount integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'menuItemId', l.menu_item_id, 'name', l.name, 'temperature', l.temperature,
           'quantity', l.quantity, 'unitPrice', l.unit_price, 'lineTotal', l.unit_price * l.quantity
         ) order by l.line_position), '[]'::jsonb),
         coalesce(sum(l.unit_price * l.quantity), 0)
    into v_lines, v_amount
    from private.price_lines(p_lines) l;
  return jsonb_build_object(
    'lines', v_lines, 'menuAmount', v_amount, 'couponDiscount', 0, 'pointsUsed', 0,
    'paidAmount', v_amount, 'usableCouponIds', '[]'::jsonb);
end;
$$;

create function private.checkout_result(p_order_id uuid, p_is_replay boolean)
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

-- Creates the PENDING_PAYMENT order and its READY payment in one transaction (P2). Idempotent per
-- (customer, client_request_id): the same request returns the same order; a changed request is a conflict.
create function public.create_checkout_order(
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
  v_method public.payment_method;
  v_order_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  stale record;
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

  -- Coupons arrive in phase (d) and points in phase (e).
  if p_user_coupon_id is not null or coalesce(p_points_to_use, 0) <> 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  select coalesce(sum(l.unit_price * l.quantity), 0) into v_amount from private.price_lines(p_lines) l;

  -- Zero-amount orders (OQ-18) need no payment provider.
  v_method := case when v_amount = 0 then 'NONE'::public.payment_method else p_payment_method end;
  if v_method is null or (v_amount > 0 and v_method = 'NONE') then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  insert into public.orders (
    id, customer_id, client_request_id, request_hash, order_type, payment_method, note,
    menu_amount, paid_amount, expires_at
  ) values (
    v_order_id, v_uid, p_client_request_id, v_hash, p_order_type, v_method, v_note,
    v_amount, v_amount, now() + make_interval(mins => store.pending_payment_ttl_minutes)
  );
  insert into public.order_items (order_id, menu_item_id, name_snapshot, temperature, quantity, unit_price, sort_order)
  select v_order_id, l.menu_item_id, l.name, l.temperature, l.quantity, l.unit_price, l.line_position
    from private.price_lines(p_lines) l;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role)
  values (v_order_id, null, 'PENDING_PAYMENT', v_uid, 'CUSTOMER');
  -- The provider id is a constant until a real gateway is chosen (create or replace this function then).
  insert into public.payments (id, order_id, provider, method, amount, idempotency_key)
  values (v_payment_id, v_order_id, 'TEST', v_method, v_amount, 'checkout:' || v_uid || ':' || p_client_request_id);

  if v_amount = 0 then
    perform private.apply_payment_result(
      v_payment_id, 'APPROVED', 'ZERO-' || v_payment_id, 0, 'zero:' || v_payment_id, 'CHECKOUT');
  end if;

  return private.checkout_result(v_order_id, false);
end;
$$;

-- ===== transitions =====

create function private.latest_refund_status(p_order_id uuid)
returns public.refund_status
language sql
stable
security definer
set search_path = ''
as $$
  select r.status
    from public.refunds r
    join public.payments p on p.id = r.payment_id
   where p.order_id = p_order_id
   order by r.created_at desc
   limit 1;
$$;

create function private.transition_result(p_order_id uuid, p_is_replay boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', o.status,
    'paymentStatus', o.payment_status,
    'refundStatus', private.latest_refund_status(o.id),
    'isReplay', p_is_replay
  )
  from public.orders o
  where o.id = p_order_id;
$$;

-- SW-03 / SW-04: staff move an order along ACCEPT, REJECT, START_PREPARING, MARK_READY, COMPLETE.
-- The expected status makes a second tablet's stale tap fail visibly instead of double-applying.
create function public.staff_transition_order(
  p_order_id uuid,
  p_action text,
  p_expected_status public.order_status,
  p_reason_code text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.orders;
  v_from public.order_status;
  v_to public.order_status;
  v_reason text := nullif(btrim(p_reason), '');
  v_actor public.actor_role := private.current_actor_role();
begin
  if not (select private.has_staff_permission('PROCESS_ORDERS')) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select case p_action
           when 'ACCEPT' then 'PAID' when 'REJECT' then 'PAID' when 'START_PREPARING' then 'ACCEPTED'
           when 'MARK_READY' then 'PREPARING' when 'COMPLETE' then 'READY' end::public.order_status,
         case p_action
           when 'ACCEPT' then 'ACCEPTED' when 'REJECT' then 'REJECTED' when 'START_PREPARING' then 'PREPARING'
           when 'MARK_READY' then 'READY' when 'COMPLETE' then 'COMPLETED' end::public.order_status
    into v_from, v_to;
  if v_to is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  ord := private.lock_order(p_order_id);
  -- Staff only know orders that were paid (PAY-05), so an unpaid or unknown id is NOT_FOUND.
  if ord.id is null or ord.paid_at is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if ord.status = v_to then
    return private.transition_result(ord.id, true);
  end if;
  if p_expected_status is distinct from ord.status then
    raise exception using errcode = 'P0001', message = 'STALE_STATUS';
  end if;
  if ord.status <> v_from then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION';
  end if;

  if p_action = 'REJECT' then
    if p_reason_code is null or p_reason_code not in ('SOLD_OUT', 'CLOSING', 'TOO_BUSY', 'OTHER')
       or (p_reason_code = 'OTHER' and v_reason is null) then
      raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
    end if;
    if char_length(v_reason) > 100 then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end if;
    update public.orders o set reject_reason_code = p_reason_code, reject_reason = v_reason where o.id = ord.id;
    perform private.change_order_status(ord.id, v_to, (select auth.uid()), v_actor, p_reason_code);
    perform private.request_refund(
      (select p.id from public.payments p where p.order_id = ord.id), 'REJECTED', (select auth.uid()));
  else
    perform private.change_order_status(ord.id, v_to, (select auth.uid()), v_actor, null);
  end if;
  return private.transition_result(ord.id, false);
end;
$$;

-- OQ-8: a customer may cancel their own order before it is paid, or while PAID (before staff accept it);
-- a PAID order is refunded in full.
create function public.customer_cancel_order(p_order_id uuid, p_expected_status public.order_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  ord public.orders;
  pay public.payments;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  ord := private.lock_order(p_order_id);
  if ord.id is null or ord.customer_id is distinct from v_uid then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if ord.status = 'CANCELLED' then
    return private.transition_result(ord.id, true);
  end if;
  if p_expected_status is distinct from ord.status then
    raise exception using errcode = 'P0001', message = 'STALE_STATUS';
  end if;
  if ord.status not in ('PENDING_PAYMENT', 'PAID') then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION';
  end if;

  select * into pay from public.payments p where p.order_id = ord.id;
  if ord.status = 'PENDING_PAYMENT' then
    if pay.status = 'READY' then
      perform private.set_payment_status(pay.id, 'CANCELLED', 'CUSTOMER_CANCELLED');
    end if;
    perform private.change_order_status(ord.id, 'CANCELLED', v_uid, 'CUSTOMER', 'CUSTOMER_CANCELLED');
  else
    perform private.change_order_status(ord.id, 'CANCELLED', v_uid, 'CUSTOMER', 'CUSTOMER_CANCELLED');
    perform private.request_refund(pay.id, 'CUSTOMER_CANCELLED', v_uid);
  end if;
  update public.orders o set cancel_reason = 'CUSTOMER_CANCELLED' where o.id = ord.id;
  return private.transition_result(ord.id, false);
end;
$$;

-- OQ-9: only admins cancel an order staff already accepted (or a PAID one), with a reason; the refund is automatic.
create function public.staff_cancel_order(
  p_order_id uuid,
  p_expected_status public.order_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.orders;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  ord := private.lock_order(p_order_id);
  if ord.id is null or ord.paid_at is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if ord.status = 'CANCELLED' then
    return private.transition_result(ord.id, true);
  end if;
  if p_expected_status is distinct from ord.status then
    raise exception using errcode = 'P0001', message = 'STALE_STATUS';
  end if;
  if ord.status not in ('PAID', 'ACCEPTED') then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION';
  end if;
  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  if char_length(v_reason) > 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  update public.orders o set cancel_reason = v_reason where o.id = ord.id;
  perform private.change_order_status(ord.id, 'CANCELLED', (select auth.uid()), 'ADMIN', v_reason);
  perform private.request_refund(
    (select p.id from public.payments p where p.order_id = ord.id), 'ADMIN_CANCELLED', (select auth.uid()));
  return private.transition_result(ord.id, false);
end;
$$;

-- ===== grants =====

revoke execute on function
  public.apply_payment_result(uuid, text, text, integer, text, text, jsonb, text),
  public.record_refund_result(uuid, boolean, text, text),
  public.expire_stale_orders(),
  public.test_pg_create(uuid, integer),
  public.test_pg_get(uuid),
  public.test_pg_set(uuid, text, text, integer, integer),
  public.test_pg_refund(text, integer, text),
  public.test_pg_force_expire(uuid),
  public.quote_checkout(jsonb),
  public.create_checkout_order(uuid, public.order_type, jsonb, uuid, integer, public.payment_method, text),
  public.staff_transition_order(uuid, text, public.order_status, text, text),
  public.customer_cancel_order(uuid, public.order_status),
  public.staff_cancel_order(uuid, public.order_status, text)
from public, anon, authenticated;

grant execute on function
  public.apply_payment_result(uuid, text, text, integer, text, text, jsonb, text),
  public.record_refund_result(uuid, boolean, text, text),
  public.expire_stale_orders(),
  public.test_pg_create(uuid, integer),
  public.test_pg_get(uuid),
  public.test_pg_set(uuid, text, text, integer, integer),
  public.test_pg_refund(text, integer, text),
  public.test_pg_force_expire(uuid)
to service_role;

grant execute on function
  public.quote_checkout(jsonb),
  public.create_checkout_order(uuid, public.order_type, jsonb, uuid, integer, public.payment_method, text),
  public.staff_transition_order(uuid, text, public.order_status, text, text),
  public.customer_cancel_order(uuid, public.order_status),
  public.staff_cancel_order(uuid, public.order_status, text)
to authenticated;
