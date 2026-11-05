-- Phase (c) RLS for orders, items, history, payments, refunds, payment_events and the order broadcasts
-- (plan sections 2, 6, 11.1). Requirements: PAY-05, SW-01, SW-02, ORD-05..08.
-- Only the rows created here are counted (ids in transaction-local settings).
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
create function public.t_order(p_uid text, p_paid boolean) returns uuid language plpgsql as $$
declare r jsonb; v_pay uuid;
begin
  perform public.t_as(p_uid);
  r := public.create_checkout_order(gen_random_uuid(), 'TAKEOUT',
    '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1}]'::jsonb, null, 0, 'CARD', null);
  perform public.t_owner();
  if p_paid then
    select id into v_pay from public.payments where order_id = (r ->> 'orderId')::uuid;
    perform public.apply_payment_result(v_pay, 'APPROVED', 'tp-' || v_pay, 4500, 'ev-' || v_pay, 'CONFIRM');
  end if;
  return (r ->> 'orderId')::uuid;
end $$;
create function public.t_count(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql into n;
  return n;
end $$;
create function public.t_rows_affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

select plan(50);

update public.store_settings set is_open = true, is_accepting_orders = true;
delete from realtime.messages where topic in ('store:orders', 'user:00000000-0000-4000-8000-0000000000c1', 'user:00000000-0000-4000-8000-0000000000c2');
insert into public.staff_members (user_id, role, permissions, display_name, is_active)
  values ('00000000-0000-4000-8000-0000000000c2', 'STAFF', '{MANAGE_OPERATIONS}', '운영만', true);

-- customer1: one paid (then rejected for a refund row) and one unpaid order. customer2: one paid order.
select set_config('t.paid1', public.t_order('00000000-0000-4000-8000-0000000000c1', true)::text, true);
select set_config('t.unpaid1', public.t_order('00000000-0000-4000-8000-0000000000c1', false)::text, true);
select set_config('t.paid2', public.t_order('00000000-0000-4000-8000-0000000000b1', true)::text, true);
select set_config('t.ids1', current_setting('t.paid1') || ',' || current_setting('t.unpaid1'), true);
select set_config('t.all', current_setting('t.ids1') || ',' || current_setting('t.paid2'), true);

-- The staff member b1 ordered as a customer too (paid2 belongs to b1); customer2 has no order here.
select t_as('00000000-0000-4000-8000-0000000000b2');
select public.staff_transition_order(current_setting('t.paid1')::uuid, 'REJECT', 'PAID', 'CLOSING');
select t_owner();

-- ===== customer1 =====
select t_as('00000000-0000-4000-8000-0000000000c1');
select is(public.t_count($$select count(*) from public.orders where id::text = any (string_to_array(current_setting('t.all'), ','))$$),
  2::bigint, 'customer sees own orders, including the unpaid one, and not other customers''');
select is(public.t_count($$select count(*) from public.order_items where order_id = current_setting('t.paid1')::uuid$$), 1::bigint, 'own items');
select is(public.t_count($$select count(*) from public.order_items where order_id = current_setting('t.paid2')::uuid$$), 0::bigint, 'not others'' items');
select is(public.t_count($$select count(*) from public.order_status_history where order_id = current_setting('t.paid1')::uuid$$), 3::bigint, 'own history');
select is(public.t_count($$select count(*) from public.order_status_history where order_id = current_setting('t.paid2')::uuid$$), 0::bigint, 'not others'' history');
select is(public.t_count($$select count(*) from public.payments where order_id = current_setting('t.paid1')::uuid$$), 1::bigint, 'own payment (limited columns)');
select is(public.t_count($$select count(*) from public.payments where order_id = current_setting('t.paid2')::uuid$$), 0::bigint, 'not others'' payments');
select is(public.t_count($$select count(*) from public.refunds where payment_id = (select id from public.payments where order_id = current_setting('t.paid1')::uuid)$$),
  1::bigint, 'own refund');
select throws_ok($$select failure_code from public.payments$$, '42501', null, 'payment failure internals are hidden from clients');
select throws_ok($$select provider_payment_id from public.payments$$, '42501', null, 'provider ids are hidden from clients');
select throws_ok($$select * from public.payment_events$$, '42501', null, 'payment_events are service-role only');
select throws_ok($$select * from public.order_number_counters$$, '42501', null, 'order counters are internal');
select throws_ok($$select * from test_pg.transactions$$, '42501', null, 'the TEST gateway data is not reachable');
select throws_ok($$insert into public.orders (client_request_id, request_hash, order_type, payment_method, menu_amount, paid_amount, expires_at)
  values (gen_random_uuid(), 'x', 'TAKEOUT', 'CARD', 1, 1, now())$$, '42501', null, 'no direct order insert');
select throws_ok($$update public.orders set status = 'COMPLETED'$$, '42501', null, 'no direct order update');
select throws_ok($$delete from public.orders$$, '42501', null, 'no direct order delete');
select throws_ok($$update public.order_items set quantity = 20$$, '42501', null, 'no direct item update');
select throws_ok($$update public.payments set status = 'PAID'$$, '42501', null, 'no direct payment update');
select throws_ok($$insert into public.refunds (payment_id, amount, reason, idempotency_key) values (gen_random_uuid(), 1, 'x', 'x')$$, '42501', null, 'no direct refund insert');
select throws_ok($$insert into public.order_status_history (order_id, to_status, actor_role) values (gen_random_uuid(), 'PAID', 'CUSTOMER')$$, '42501', null, 'no direct history insert');
select t_owner();

-- ===== staff with PROCESS_ORDERS (barista) =====
select t_as('00000000-0000-4000-8000-0000000000b2');
select is(public.t_count($$select count(*) from public.orders where id::text = any (string_to_array(current_setting('t.all'), ','))$$),
  2::bigint, 'PAY-05 staff see paid orders only, never the PENDING_PAYMENT one');
select is(public.t_count($$select count(*) from public.orders where id = current_setting('t.unpaid1')::uuid$$), 0::bigint, 'the unpaid order is invisible to staff');
select is(public.t_count($$select count(*) from public.order_items where order_id = current_setting('t.paid2')::uuid$$), 1::bigint, 'staff read the items of visible orders');
select is(public.t_count($$select count(*) from public.refunds$$), 0::bigint, 'only admins read refunds');
select throws_ok($$select * from public.payment_events$$, '42501', null, 'staff cannot read payment_events');
select throws_ok($$update public.orders set status = 'COMPLETED'$$, '42501', null, 'staff cannot update orders directly');
select t_owner();

-- ===== staff without PROCESS_ORDERS, inactive staff, anon =====
select t_as('00000000-0000-4000-8000-0000000000c2');
select is(public.t_count($$select count(*) from public.orders where id::text = any (string_to_array(current_setting('t.all'), ','))$$),
  0::bigint, 'staff with MANAGE_OPERATIONS only see no orders');
select t_as('00000000-0000-4000-8000-0000000000b3');
select is(public.t_count($$select count(*) from public.orders where id::text = any (string_to_array(current_setting('t.all'), ','))$$),
  0::bigint, 'inactive staff see no orders');
select t_anon();
select throws_ok($$select * from public.orders$$, '42501', null, 'anon cannot read orders');
select throws_ok($$select * from public.order_items$$, '42501', null, 'anon cannot read items');
select throws_ok($$select * from public.payments$$, '42501', null, 'anon cannot read payments');
select throws_ok($$select * from public.refunds$$, '42501', null, 'anon cannot read refunds');
select t_owner();

-- ===== admin =====
select t_as('00000000-0000-4000-8000-0000000000a1');
select is(public.t_count($$select count(*) from public.orders where id::text = any (string_to_array(current_setting('t.all'), ','))$$),
  2::bigint, 'admin reads paid orders, not unpaid ones');
select is(public.t_count($$select count(*) from public.refunds where payment_id = (select id from public.payments where order_id = current_setting('t.paid1')::uuid)$$),
  1::bigint, 'admin reads refunds');
select throws_ok($$select * from public.payment_events$$, '42501', null, 'even admin cannot read payment_events with the client key');
select t_owner();

-- ===== broadcasts: ids and statuses only, to the right topics =====
select is((select count(*) from realtime.messages where topic = 'store:orders' and event = 'order_paid'
  and payload ->> 'orderId' in (current_setting('t.paid1'), current_setting('t.paid2'))), 2::bigint,
  'each paid order sends one order_paid to the board topic');
select is((select count(*) from realtime.messages where topic = 'store:orders' and event = 'order_updated'
  and payload ->> 'orderId' = current_setting('t.paid1') and payload ->> 'status' = 'REJECTED'), 1::bigint,
  'a reject sends order_updated to the board');
select is((select count(*) from realtime.messages where topic = 'store:orders' and payload ->> 'orderId' = current_setting('t.unpaid1')),
  0::bigint, 'an unpaid checkout is never broadcast to the board');
select is((select count(*) from realtime.messages where topic = 'user:00000000-0000-4000-8000-0000000000c1'
  and event = 'order_updated' and payload ->> 'orderId' = current_setting('t.paid1')), 4::bigint,
  'the owning customer gets an order_updated for each change of status or payment');
select is((select count(*) from realtime.messages where topic = 'user:00000000-0000-4000-8000-0000000000c2'
  and payload ? 'orderId'), 0::bigint, 'another customer''s topic gets nothing');
select is((select array(select k from jsonb_object_keys(payload - 'id') k order by k) from realtime.messages
  where topic = 'store:orders' and payload ->> 'orderId' = current_setting('t.paid1') limit 1),
  array['orderId', 'paymentStatus', 'status', 'updatedAt'], 'payloads carry ids and statuses only (no PII)');

-- ===== who may listen =====
select t_as('00000000-0000-4000-8000-0000000000c1');
select set_config('realtime.topic', 'user:00000000-0000-4000-8000-0000000000c1', true);
select cmp_ok((select count(*) from realtime.messages where extension = 'broadcast'), '>=', 4::bigint, 'a customer can listen to their own topic');
select set_config('realtime.topic', 'user:00000000-0000-4000-8000-0000000000c2', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint, 'but not another customer''s topic');
select set_config('realtime.topic', 'store:orders', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint, 'and not the board topic');
select t_as('00000000-0000-4000-8000-0000000000b2');
select set_config('realtime.topic', 'store:orders', true);
select cmp_ok((select count(*) from realtime.messages where extension = 'broadcast'), '>=', 3::bigint, 'staff with PROCESS_ORDERS can listen to the board topic');
select set_config('realtime.topic', 'user:00000000-0000-4000-8000-0000000000c1', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint, 'staff cannot listen to a customer topic');
select t_as('00000000-0000-4000-8000-0000000000c2');
select set_config('realtime.topic', 'store:orders', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint, 'staff without PROCESS_ORDERS cannot listen to the board');
select t_as('00000000-0000-4000-8000-0000000000b3');
select set_config('realtime.topic', 'store:orders', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint, 'inactive staff cannot listen to the board');
select t_anon();
select set_config('realtime.topic', 'store:orders', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint, 'anon cannot listen to the board');
select t_owner();

-- ===== scheduled jobs =====
select is((select count(*) from cron.job where jobname in ('expire-stale-orders', 'payments-reconcile') and active), 2::bigint,
  'the expiry and reconcile jobs are scheduled');

select * from finish();
rollback;
