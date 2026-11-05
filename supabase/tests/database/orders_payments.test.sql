-- Phase (c) payment state: apply_payment_result, refunds, expiry, order numbers (plan sections 3.3, 4.2, 4.3, 11.2, 11.3).
-- Requirements: PAY-05, PAY-06, PAY-07, OQ-13 (A-<n> per KST day, assigned at payment), OQ-14.
-- Every assertion targets rows created here (ids in transaction-local settings), never table totals.
begin;

create function public.t_as(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.t_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;
-- New PENDING_PAYMENT order of customer1 (one americano), created through the real RPC.
create function public.t_order(p_req uuid) returns uuid language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as('00000000-0000-4000-8000-0000000000c1');
  r := public.create_checkout_order(p_req, 'TAKEOUT',
    '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1}]'::jsonb, null, 0, 'CARD', null);
  perform public.t_owner();
  return (r ->> 'orderId')::uuid;
end $$;
create function public.t_pid(p_order uuid) returns uuid language sql as $$
  select id from public.payments where order_id = p_order;
$$;
create function public.t_apply(p_order uuid, p_outcome text, p_event text, p_amount int default 4500) returns jsonb language sql as $$
  select public.apply_payment_result(public.t_pid(p_order), p_outcome, 'tp-' || p_order, p_amount, p_event, 'CONFIRM');
$$;

select plan(49);

update public.store_settings set is_open = true, is_accepting_orders = true;

-- ===== approval =====
select set_config('t.o1', public.t_order('b0000000-0000-4000-8000-000000000001')::text, true);
select set_config('t.counter', coalesce((select last_value from public.order_number_counters
  where business_date = (now() at time zone 'Asia/Seoul')::date), 0)::text, true);
select set_config('t.a1', public.t_apply(current_setting('t.o1')::uuid, 'APPROVED', 'ev-1')::text, true);
select is(current_setting('t.a1')::jsonb ->> 'result', 'APPLIED', 'a verified approval is applied');
select is((select row(status, payment_status)::text from public.orders where id = current_setting('t.o1')::uuid),
  '(PAID,PAID)', 'order and mirrored payment status become PAID');
select is((select status::text from public.payments where order_id = current_setting('t.o1')::uuid), 'PAID', 'payment is PAID');
select is((select provider_payment_id from public.payments where order_id = current_setting('t.o1')::uuid),
  'tp-' || current_setting('t.o1'), 'the provider payment id is stored');
select ok((select paid_at is not null and business_date = (paid_at at time zone 'Asia/Seoul')::date
  and order_number = 'A-' || (current_setting('t.counter')::int + 1)
  from public.orders where id = current_setting('t.o1')::uuid),
  'OQ-13 the number is A-<n>, assigned at payment, on the KST business date');
select is((select count(*) from public.order_status_history where order_id = current_setting('t.o1')::uuid), 2::bigint,
  'creation and payment wrote two history rows');
select is((select actor_role::text from public.order_status_history where order_id = current_setting('t.o1')::uuid
  and to_status = 'PAID'), 'SYSTEM', 'the PAID change is attributed to SYSTEM');

-- ===== duplicates =====
select is(public.t_apply(current_setting('t.o1')::uuid, 'APPROVED', 'ev-1') ->> 'result', 'DUPLICATE',
  'PAY-06 the same provider event twice is a duplicate');
select is(public.t_apply(current_setting('t.o1')::uuid, 'APPROVED', 'ev-2') ->> 'result', 'DUPLICATE',
  'a second callback with a new event id finds the payment already PAID');
select is((select count(*) from public.order_status_history where order_id = current_setting('t.o1')::uuid), 2::bigint,
  'duplicates add no history');
select is((select order_number from public.orders where id = current_setting('t.o1')::uuid),
  'A-' || (current_setting('t.counter')::int + 1), 'duplicates do not consume order numbers');
select is((select count(*) from public.payment_events where payment_id = public.t_pid(current_setting('t.o1')::uuid)),
  2::bigint, 'one APPLIED event and one DUPLICATE (state) event are recorded; the repeated event id is not stored twice');
select throws_ok($$update public.payment_events set result = 'APPLIED'$$, 'P0001', 'APPEND_ONLY', 'payment_events are append-only');
select throws_ok($$select public.apply_payment_result('00000000-0000-4000-8000-0000000fffff', 'APPROVED', 'x', 1, 'e', 'CONFIRM')$$,
  'P0001', 'NOT_FOUND', 'an unknown payment id');
select throws_ok($$select public.apply_payment_result(public.t_pid(current_setting('t.o1')::uuid), 'BOGUS', 'x', 1, 'e', 'CONFIRM')$$,
  'P0001', 'INVALID_INPUT', 'an unknown outcome');

-- Abandoned checkouts consume no numbers; the next paid order is the next number.
select set_config('t.o_aband1', public.t_order('b0000000-0000-4000-8000-000000000002')::text, true);
select set_config('t.o_aband2', public.t_order('b0000000-0000-4000-8000-000000000003')::text, true);
select set_config('t.o2', public.t_order('b0000000-0000-4000-8000-000000000004')::text, true);
select public.t_apply(current_setting('t.o2')::uuid, 'APPROVED', 'ev-3');
select is((select order_number from public.orders where id = current_setting('t.o2')::uuid),
  'A-' || (current_setting('t.counter')::int + 2), 'unpaid orders leave no gaps in the numbers');
select is((select count(*) from public.orders where id in (current_setting('t.o_aband1')::uuid, current_setting('t.o_aband2')::uuid)
  and order_number is null), 2::bigint, 'abandoned checkouts have no number');

-- Numbering restarts every KST business day.
select is(private.next_order_number('2031-01-01'), 'A-1', 'first number of a day');
select is(private.next_order_number('2031-01-01'), 'A-2', 'second number of the same day');
select is(private.next_order_number('2031-01-02'), 'A-1', 'a new KST day restarts at 1');

-- ===== failure and cancel =====
select set_config('t.o3', public.t_order('b0000000-0000-4000-8000-000000000005')::text, true);
select is(public.t_apply(current_setting('t.o3')::uuid, 'FAILED', 'ev-f1', null) ->> 'result', 'APPLIED', 'a provider failure is applied');
select is((select row(o.status, o.payment_status, p.failure_code)::text from public.orders o
  join public.payments p on p.order_id = o.id where o.id = current_setting('t.o3')::uuid),
  '(CANCELLED,FAILED,FAILED)', 'failure cancels the order and fails the payment');
select is(public.t_apply(current_setting('t.o3')::uuid, 'APPROVED', 'ev-f2') ->> 'result', 'DUPLICATE',
  'an approval after a provider failure changes nothing');
select is((select status::text from public.orders where id = current_setting('t.o3')::uuid), 'CANCELLED', 'the order stays cancelled');

select set_config('t.o4', public.t_order('b0000000-0000-4000-8000-000000000006')::text, true);
select public.t_apply(current_setting('t.o4')::uuid, 'CANCELLED', 'ev-c1', null);
select is((select row(o.status, o.payment_status)::text from public.orders o where o.id = current_setting('t.o4')::uuid),
  '(CANCELLED,CANCELLED)', 'a cancel at the provider cancels order and payment');

-- ===== amount mismatch =====
select set_config('t.o5', public.t_order('b0000000-0000-4000-8000-000000000007')::text, true);
select set_config('t.a5', public.t_apply(current_setting('t.o5')::uuid, 'APPROVED', 'ev-m1', 100)::text, true);
select is(current_setting('t.a5')::jsonb ->> 'result', 'REJECTED', 'PAY-07 an approval with the wrong amount is rejected');
select is((current_setting('t.a5')::jsonb ->> 'cancelAtProvider')::boolean, true, 'and the caller is told to cancel at the provider');
select is((select row(o.status, o.payment_status, p.failure_code)::text from public.orders o
  join public.payments p on p.order_id = o.id where o.id = current_setting('t.o5')::uuid),
  '(CANCELLED,FAILED,AMOUNT_MISMATCH)', 'order cancelled, payment failed with AMOUNT_MISMATCH');
select ok((select paid_at is null and order_number is null from public.orders where id = current_setting('t.o5')::uuid),
  'a mismatched payment never produces a paid order or number');

-- ===== late approval after expiry =====
select set_config('t.o6', public.t_order('b0000000-0000-4000-8000-000000000008')::text, true);
update public.orders set expires_at = now() - interval '1 second' where id = current_setting('t.o6')::uuid;
select is((select private.expire_order(current_setting('t.o6')::uuid)), true, 'the overdue unpaid order expires');
select is((select row(o.status, o.payment_status, p.failure_code)::text from public.orders o
  join public.payments p on p.order_id = o.id where o.id = current_setting('t.o6')::uuid),
  '(CANCELLED,CANCELLED,EXPIRED)', 'expiry cancels order and payment');
select is((select private.expire_order(current_setting('t.o6')::uuid)), false, 'expiring twice is a no-op');
select set_config('t.a6', public.t_apply(current_setting('t.o6')::uuid, 'APPROVED', 'ev-l1')::text, true);
select is(current_setting('t.a6')::jsonb ->> 'result', 'APPLIED', 'a late approval is recorded');
select is((select row(o.status, o.payment_status)::text from public.orders o where o.id = current_setting('t.o6')::uuid),
  '(CANCELLED,PAID)', 'the order stays CANCELLED while the captured payment is PAID');
select is((select row(r.status, r.amount, r.reason)::text from public.refunds r
  where r.id = (current_setting('t.a6')::jsonb ->> 'refundId')::uuid), '(REQUESTED,4500,LATE_APPROVAL)',
  'an automatic full refund is requested');
select is(public.t_apply(current_setting('t.o6')::uuid, 'APPROVED', 'ev-l2') ->> 'result', 'DUPLICATE', 'a repeated late approval is a duplicate');
select is((select count(*) from public.refunds where payment_id = public.t_pid(current_setting('t.o6')::uuid)), 1::bigint,
  'and creates no second refund');

-- ===== refund results =====
select is(public.record_refund_result((current_setting('t.a6')::jsonb ->> 'refundId')::uuid, false, null, 'gateway down') ->> 'refundStatus',
  'FAILED', 'a failed refund call is recorded');
select is((select status::text from public.payments where order_id = current_setting('t.o6')::uuid), 'PAID',
  'the payment stays PAID until a refund succeeds');
select is(public.record_refund_result((current_setting('t.a6')::jsonb ->> 'refundId')::uuid, true, 'rf-1', null) ->> 'paymentStatus',
  'REFUNDED', 'a retried refund that succeeds marks the payment REFUNDED');
select is(public.record_refund_result((current_setting('t.a6')::jsonb ->> 'refundId')::uuid, false, null, 'late failure') ->> 'refundStatus',
  'SUCCEEDED', 'a refund result is idempotent once succeeded');
select is((select payment_status::text from public.orders where id = current_setting('t.o6')::uuid), 'REFUNDED', 'orders.payment_status mirrors REFUNDED');

-- ===== scheduled expiry =====
select set_config('t.o7', public.t_order('b0000000-0000-4000-8000-000000000009')::text, true);
update public.orders set expires_at = now() - interval '1 second' where id in (current_setting('t.o7')::uuid, current_setting('t.o1')::uuid);
select cmp_ok(private.expire_stale_orders(), '>=', 1, 'the scheduled job expires overdue unpaid orders');
select is((select status::text from public.orders where id = current_setting('t.o7')::uuid), 'CANCELLED', 'the overdue order was cancelled');
select is((select status::text from public.orders where id = current_setting('t.o1')::uuid), 'PAID', 'a paid order is never touched by expiry');

-- ===== access =====
select t_as('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.apply_payment_result(public.t_pid(current_setting('t.o7')::uuid), 'APPROVED', 'x', 4500, 'ev-x', 'CONFIRM')$$,
  '42501', null, 'customers cannot call apply_payment_result');
select throws_ok($$select public.record_refund_result('00000000-0000-4000-8000-0000000fffff', true, 'x', null)$$,
  '42501', null, 'customers cannot record refund results');
select throws_ok($$select public.expire_stale_orders()$$, '42501', null, 'customers cannot run the expiry job');
select throws_ok($$select public.test_pg_get('00000000-0000-4000-8000-0000000fffff')$$, '42501', null, 'customers cannot reach the TEST gateway data');
select t_owner();

select * from finish();
rollback;
