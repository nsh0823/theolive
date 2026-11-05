-- Phase (c) defect fixes (QA): durable provider-cancel obligations, bounded late-approval lookups,
-- null provider id guard, single price snapshot at checkout, menu/order FK restrict, private schema grants.

-- ===== provider_cancels: a provider-side cancel the system still owes (amount-mismatch approvals) =====
create table public.provider_cancels (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  provider_payment_id text not null,
  amount integer not null check (amount >= 0),
  reason text not null,
  status public.refund_status not null default 'REQUESTED',
  attempts integer not null default 0,
  failure_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index provider_cancels_open_idx on public.provider_cancels (created_at) where status <> 'SUCCEEDED';
alter table public.provider_cancels enable row level security;
revoke all on public.provider_cancels from public, anon, authenticated;
grant select, update on public.provider_cancels to service_role;

-- Reconcile looks up payments cancelled before approval (expiry / customer cancel) inside a window.
create index payments_cancelled_before_approval_idx on public.payments (cancelled_at)
  where status = 'CANCELLED' and failure_code in ('EXPIRED', 'CUSTOMER_CANCELLED');

create or replace function private.apply_payment_result(
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

  -- An approval without a provider payment id cannot be traced or refunded, so it is never accepted. Nothing
  -- is recorded: a later answer that carries the id (reconcile) is still processed.
  if p_outcome = 'APPROVED' and nullif(btrim(coalesce(p_provider_payment_id, '')), '') is null then
    return private.payment_summary(pay.id, 'REJECTED', null, false);
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
        -- The provider-side cancel is a durable obligation: reconcile retries it until it succeeds.
        insert into public.provider_cancels (payment_id, provider_payment_id, amount, reason)
        values (pay.id, p_provider_payment_id, coalesce(p_amount, pay.amount), 'AMOUNT_MISMATCH')
        on conflict (payment_id) do nothing;
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
  v_method public.payment_method;
  v_order_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  stale record;
  v_priced jsonb;
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

  -- Prices are read once; the sum and the inserted items both come from this one snapshot.
  select coalesce(jsonb_agg(jsonb_build_object(
           'menu_item_id', l.menu_item_id, 'name', l.name, 'temperature', l.temperature,
           'quantity', l.quantity, 'unit_price', l.unit_price, 'position', l.line_position
         ) order by l.line_position), '[]'::jsonb)
    into v_priced
    from private.price_lines(p_lines) l;
  select coalesce(sum((e.value ->> 'unit_price')::integer * (e.value ->> 'quantity')::integer), 0)
    into v_amount
    from jsonb_array_elements(v_priced) e;

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
  select v_order_id, (e.value ->> 'menu_item_id')::uuid, e.value ->> 'name',
         nullif(e.value ->> 'temperature', '')::public.temperature,
         (e.value ->> 'quantity')::integer, (e.value ->> 'unit_price')::integer,
         (e.value ->> 'position')::integer
    from jsonb_array_elements(v_priced) e;
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

-- ===== order_items.menu_item_id: a hard delete of an ordered menu item is refused (archive instead) =====
alter table public.order_items drop constraint order_items_menu_item_id_fkey;
alter table public.order_items
  add constraint order_items_menu_item_id_fkey foreign key (menu_item_id)
  references public.menu_items (id) on delete restrict;

-- ===== private schema grants =====
-- Row-level-security policies run as the calling role, so authenticated keeps USAGE on schema private and
-- EXECUTE on exactly the three role helpers the policies call. Every other private function is reachable only
-- through SECURITY DEFINER wrappers (which run as the owner) or triggers (privilege checked at creation).
revoke execute on all functions in schema private from public, anon, authenticated;
revoke all on schema private from anon;
grant execute on function
  private.is_admin(), private.is_active_staff(), private.has_staff_permission(public.staff_permission)
to authenticated;
alter default privileges in schema private revoke execute on functions from anon, authenticated;
