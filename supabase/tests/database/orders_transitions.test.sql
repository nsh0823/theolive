-- Phase (c) order state machine: staff_transition_order, customer_cancel_order, staff_cancel_order
-- (plan sections 4.1, 11.1 and 11.2). Requirements: SW-03, SW-04, SW-05, SW-06, ORD-05..08, OQ-8, OQ-9, OQ-10.
-- Assertions only look at rows this test creates (ids in transaction-local settings).
begin;

create function public.t_as(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.t_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end $$;
create function public.t_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;
-- Creates a PENDING_PAYMENT order for p_uid through the RPC; optionally pays it. Runs as the owner.
create function public.t_order(p_uid text, p_req uuid, p_paid boolean, p_item text default '00000000-0000-4000-8000-000000000201')
returns uuid language plpgsql as $$
declare r jsonb; v_pay uuid;
begin
  perform public.t_as(p_uid);
  r := public.create_checkout_order(p_req, 'TAKEOUT',
    jsonb_build_array(jsonb_build_object('menuItemId', p_item, 'temperature', case when p_item = '00000000-0000-4000-8000-000000000201' then 'HOT' else null end, 'quantity', 1)),
    null, 0, 'CARD', null);
  perform public.t_owner();
  if p_paid and r ->> 'status' <> 'PAID' then
    select id into v_pay from public.payments where order_id = (r ->> 'orderId')::uuid;
    perform public.apply_payment_result(v_pay, 'APPROVED', 'tp-' || v_pay, (r ->> 'amount')::int, 'ev-' || v_pay, 'CONFIRM');
  end if;
  return (r ->> 'orderId')::uuid;
end $$;

-- Exercises every action against every order status as the given user. Result is what the RPC answered.
create function public.t_matrix(p_uid text) returns table (act text, from_status text, expected text, actual text)
language plpgsql as $$
declare
  v_order uuid := public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), true);
  v_status text;
  v_act text;
  v_actual text;
  v_denied boolean := p_uid not in ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b2',
                                    '00000000-0000-4000-8000-0000000000a1');
begin
  foreach v_status in array enum_range(null::public.order_status)::text[] loop
    foreach v_act in array array['ACCEPT', 'REJECT', 'START_PREPARING', 'MARK_READY', 'COMPLETE'] loop
      perform public.t_owner();
      update public.orders set status = v_status::public.order_status where id = v_order;
      perform public.t_as(p_uid);
      begin
        v_actual := case when (public.staff_transition_order(v_order, v_act, v_status::public.order_status,
                          case when v_act = 'REJECT' then 'SOLD_OUT' end, null) ->> 'isReplay')::boolean
                         then 'REPLAY' else 'OK' end;
      exception when others then
        v_actual := sqlerrm;
      end;
      perform public.t_owner();
      act := v_act;
      from_status := v_status;
      actual := v_actual;
      expected := case
        when v_denied then 'FORBIDDEN'
        when (v_act, v_status) in (('ACCEPT', 'PAID'), ('REJECT', 'PAID'), ('START_PREPARING', 'ACCEPTED'),
                                   ('MARK_READY', 'PREPARING'), ('COMPLETE', 'READY')) then 'OK'
        when (v_act, v_status) in (('ACCEPT', 'ACCEPTED'), ('REJECT', 'REJECTED'), ('START_PREPARING', 'PREPARING'),
                                   ('MARK_READY', 'READY'), ('COMPLETE', 'COMPLETED')) then 'REPLAY'
        else 'INVALID_TRANSITION' end;
      return next;
    end loop;
  end loop;
end $$;

select plan(50);

update public.store_settings set is_open = true, is_accepting_orders = true;
-- customer2 becomes staff with MANAGE_OPERATIONS only (no PROCESS_ORDERS) for the "wrong permission" cases.
insert into public.staff_members (user_id, role, permissions, display_name, is_active)
  values ('00000000-0000-4000-8000-0000000000c2', 'STAFF', '{MANAGE_OPERATIONS}', '운영만', true);

-- ===== full matrix: every action x every status (8 x 5 = 40 cases) per role =====
create temp table matrix_barista as select * from public.t_matrix('00000000-0000-4000-8000-0000000000b2');
create temp table matrix_admin as select * from public.t_matrix('00000000-0000-4000-8000-0000000000a1');
create temp table matrix_ops_only as select * from public.t_matrix('00000000-0000-4000-8000-0000000000c2');
create temp table matrix_customer as select * from public.t_matrix('00000000-0000-4000-8000-0000000000c1');
create temp table matrix_inactive as select * from public.t_matrix('00000000-0000-4000-8000-0000000000b3');
select is((select count(*) from matrix_barista), 40::bigint, 'the matrix covers 5 actions x 8 statuses');
select is((select count(*) from matrix_barista where expected <> actual), 0::bigint,
  'staff with PROCESS_ORDERS: every valid edge succeeds, repeats replay, every other pair is INVALID_TRANSITION');
select is((select count(*) from matrix_barista where expected = 'OK'), 5::bigint, 'exactly 5 valid edges');
select is((select count(*) from matrix_admin where expected <> actual), 0::bigint, 'admin: same matrix');
select is((select count(*) from matrix_ops_only where actual <> 'FORBIDDEN'), 0::bigint, 'staff without PROCESS_ORDERS are denied everywhere');
select is((select count(*) from matrix_customer where actual <> 'FORBIDDEN'), 0::bigint, 'customers are denied everywhere');
select is((select count(*) from matrix_inactive where actual <> 'FORBIDDEN'), 0::bigint, 'inactive staff are denied everywhere');

-- ===== normal flow with history =====
select set_config('t.o1', public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), true)::text, true);
select t_as('00000000-0000-4000-8000-0000000000b2');
select is(public.staff_transition_order(current_setting('t.o1')::uuid, 'ACCEPT', 'PAID') ->> 'status', 'ACCEPTED', 'PAID -> ACCEPTED');
select is(public.staff_transition_order(current_setting('t.o1')::uuid, 'START_PREPARING', 'ACCEPTED') ->> 'status', 'PREPARING', 'ACCEPTED -> PREPARING');
select is(public.staff_transition_order(current_setting('t.o1')::uuid, 'MARK_READY', 'PREPARING') ->> 'status', 'READY', 'PREPARING -> READY');
select is(public.staff_transition_order(current_setting('t.o1')::uuid, 'COMPLETE', 'READY') ->> 'status', 'COMPLETED', 'READY -> COMPLETED');
select is(public.staff_transition_order(current_setting('t.o1')::uuid, 'COMPLETE', 'READY') ->> 'isReplay', 'true', 'a repeated tap is a replay, not an error');
select throws_ok($$select public.staff_transition_order(current_setting('t.o1')::uuid, 'ACCEPT', 'PAID')$$, 'P0001', 'STALE_STATUS',
  'a tablet with an outdated view gets STALE_STATUS');
select t_owner();
select is((select count(*) from public.order_status_history where order_id = current_setting('t.o1')::uuid), 6::bigint,
  'creation, payment and four staff steps are each one history row; the replay added none');
select is((select count(*) from public.order_status_history where order_id = current_setting('t.o1')::uuid
  and actor_role = 'STAFF' and actor_id = '00000000-0000-4000-8000-0000000000b2'), 4::bigint, 'staff steps carry the staff actor');
select ok((select accepted_at is not null and preparing_at is not null and ready_at is not null and completed_at is not null
  from public.orders where id = current_setting('t.o1')::uuid), 'each step stamps its timestamp');

-- ===== unknown / unpaid / bad action =====
select set_config('t.unpaid', public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), false)::text, true);
select t_as('00000000-0000-4000-8000-0000000000b2');
select throws_ok($$select public.staff_transition_order(current_setting('t.unpaid')::uuid, 'ACCEPT', 'PENDING_PAYMENT')$$,
  'P0001', 'NOT_FOUND', 'PAY-05 staff cannot act on an unpaid order');
select throws_ok($$select public.staff_transition_order('00000000-0000-4000-8000-0000000fffff', 'ACCEPT', 'PAID')$$, 'P0001', 'NOT_FOUND', 'unknown order');
select throws_ok($$select public.staff_transition_order(current_setting('t.o1')::uuid, 'EXPLODE', 'PAID')$$, 'P0001', 'INVALID_INPUT', 'unknown action');
select t_anon();
select throws_ok($$select public.staff_transition_order(current_setting('t.o1')::uuid, 'ACCEPT', 'PAID')$$, '42501', null, 'anon cannot call it');
select throws_ok($$select public.customer_cancel_order(current_setting('t.o1')::uuid, 'PAID')$$, '42501', null, 'anon cannot cancel');
select t_owner();

-- ===== rejection (OQ-10) =====
select set_config('t.o2', public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), true)::text, true);
select t_as('00000000-0000-4000-8000-0000000000b2');
select throws_ok($$select public.staff_transition_order(current_setting('t.o2')::uuid, 'REJECT', 'PAID')$$, 'P0001', 'REASON_REQUIRED', 'a reject needs a reason code');
select throws_ok($$select public.staff_transition_order(current_setting('t.o2')::uuid, 'REJECT', 'PAID', 'BECAUSE')$$, 'P0001', 'REASON_REQUIRED', 'unknown reason code');
select throws_ok($$select public.staff_transition_order(current_setting('t.o2')::uuid, 'REJECT', 'PAID', 'OTHER', '   ')$$, 'P0001', 'REASON_REQUIRED', 'OTHER needs free text');
select throws_ok($$select public.staff_transition_order(current_setting('t.o2')::uuid, 'REJECT', 'PAID', 'OTHER', repeat('가', 101))$$, 'P0001', 'INVALID_INPUT', 'free text above 100 characters');
select is(public.staff_transition_order(current_setting('t.o2')::uuid, 'REJECT', 'PAID', 'OTHER', '재료 소진')  ->> 'status', 'REJECTED', 'reject with a reason');
select t_owner();
select is((select row(reject_reason_code, reject_reason, payment_status)::text from public.orders where id = current_setting('t.o2')::uuid),
  '(OTHER,"재료 소진",PAID)', 'the reason is stored; the payment is PAID until the refund succeeds');
select is((select row(r.status, r.amount, r.reason)::text from public.refunds r
  where r.payment_id = (select id from public.payments where order_id = current_setting('t.o2')::uuid)),
  '(REQUESTED,4500,REJECTED)', 'a reject requests a full automatic refund');
select is(public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = current_setting('t.o2')::uuid), true, 'rf-r', null) ->> 'paymentStatus', 'REFUNDED', 'the refund completes the payment as REFUNDED');
select t_as('00000000-0000-4000-8000-0000000000b2');
select is(public.staff_transition_order(current_setting('t.o2')::uuid, 'REJECT', 'PAID', 'SOLD_OUT') ->> 'isReplay', 'true', 'rejecting again is a replay');
select t_owner();
select is((select count(*) from public.refunds r join public.payments p on p.id = r.payment_id where p.order_id = current_setting('t.o2')::uuid),
  1::bigint, 'a replayed reject creates no second refund');

-- ===== zero-amount order reject: nothing to refund =====
insert into public.menu_items (id, category_id, name, price, temperatures)
  values ('00000000-0000-4000-8000-000000000e01', '00000000-0000-4000-8000-000000000105', '무료 시식', 0, '{}');
select set_config('t.zero', public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), true, '00000000-0000-4000-8000-000000000e01')::text, true);
select t_as('00000000-0000-4000-8000-0000000000b2');
select is(public.staff_transition_order(current_setting('t.zero')::uuid, 'REJECT', 'PAID', 'CLOSING') ->> 'refundStatus', null, 'a zero-amount order has no refund');
select t_owner();

-- ===== customer cancel (OQ-8) =====
select set_config('t.c1', public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), false)::text, true);
select t_as('00000000-0000-4000-8000-0000000000c1');
select is(public.customer_cancel_order(current_setting('t.c1')::uuid, 'PENDING_PAYMENT') ->> 'status', 'CANCELLED', 'cancel before payment');
select t_owner();
select is((select payment_status::text from public.orders where id = current_setting('t.c1')::uuid), 'CANCELLED', 'the open payment is cancelled with it');
select is((select count(*) from public.refunds r join public.payments p on p.id = r.payment_id where p.order_id = current_setting('t.c1')::uuid),
  0::bigint, 'nothing was paid, so nothing is refunded');

select set_config('t.c2', public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), true)::text, true);
select t_as('00000000-0000-4000-8000-0000000000c2');
select throws_ok($$select public.customer_cancel_order(current_setting('t.c2')::uuid, 'PAID')$$, 'P0001', 'NOT_FOUND', 'another customer cannot cancel it (and learns nothing)');
select t_as('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.customer_cancel_order(current_setting('t.c2')::uuid, 'ACCEPTED')$$, 'P0001', 'STALE_STATUS', 'stale expected status');
select is(public.customer_cancel_order(current_setting('t.c2')::uuid, 'PAID') ->> 'refundStatus', 'REQUESTED', 'cancel while PAID requests a refund');
select is(public.customer_cancel_order(current_setting('t.c2')::uuid, 'PAID') ->> 'isReplay', 'true', 'cancelling again is a replay');
select t_owner();
select is((select count(*) from public.refunds r join public.payments p on p.id = r.payment_id where p.order_id = current_setting('t.c2')::uuid),
  1::bigint, 'one refund only');

select set_config('t.c3', public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), true)::text, true);
select t_as('00000000-0000-4000-8000-0000000000b2');
select public.staff_transition_order(current_setting('t.c3')::uuid, 'ACCEPT', 'PAID');
select t_as('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.customer_cancel_order(current_setting('t.c3')::uuid, 'ACCEPTED')$$, 'P0001', 'INVALID_TRANSITION',
  'a customer cannot cancel once staff accepted');

-- ===== admin cancel of an accepted order (OQ-9) =====
select t_as('00000000-0000-4000-8000-0000000000b2');
select throws_ok($$select public.staff_cancel_order(current_setting('t.c3')::uuid, 'ACCEPTED', '사유')$$, 'P0001', 'FORBIDDEN', 'staff cannot cancel accepted orders');
select t_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.staff_cancel_order(current_setting('t.c3')::uuid, 'ACCEPTED', '  ')$$, 'P0001', 'REASON_REQUIRED', 'a reason is required');
select throws_ok($$select public.staff_cancel_order(current_setting('t.c3')::uuid, 'PAID', '사유')$$, 'P0001', 'STALE_STATUS', 'stale status');
select is(public.staff_cancel_order(current_setting('t.c3')::uuid, 'ACCEPTED', '고객 요청') ->> 'refundStatus', 'REQUESTED', 'admin cancels an ACCEPTED order and a refund is requested');
select is(public.staff_cancel_order(current_setting('t.c3')::uuid, 'ACCEPTED', '고객 요청') ->> 'isReplay', 'true', 'cancelling again is a replay');
select t_owner();
select is((select row(status, cancel_reason)::text from public.orders where id = current_setting('t.c3')::uuid), '(CANCELLED,"고객 요청")', 'order cancelled with the reason');
select is((select actor_role::text from public.order_status_history where order_id = current_setting('t.c3')::uuid and to_status = 'CANCELLED'),
  'ADMIN', 'history records the admin');

select set_config('t.c4', public.t_order('00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), true)::text, true);
update public.orders set status = 'PREPARING' where id = current_setting('t.c4')::uuid;
select t_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.staff_cancel_order(current_setting('t.c4')::uuid, 'PREPARING', '사유')$$, 'P0001', 'INVALID_TRANSITION', 'a preparing order cannot be cancelled');
select t_as('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.staff_cancel_order(current_setting('t.c4')::uuid, 'PREPARING', '사유')$$, 'P0001', 'FORBIDDEN', 'customers cannot use staff_cancel_order');
select t_owner();

select * from finish();
rollback;
