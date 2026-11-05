-- Phase (c) checkout: create_checkout_order and quote_checkout (plan sections 3.1, 4.3, 11.2, 11.3).
-- Requirements: PAY-01, ORD-05..08, ORD-10, OQ-14 (15 minute lifetime), OQ-18 (zero-amount orders).
-- Assertions only look at rows this test creates (ids kept in transaction-local settings), so rows committed by
-- other suites (API integration tests) never change the result.
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

-- One line of seeded menu item 201 (아메리카노, 4500, HOT/ICE).
create function public.t_line(p_item text, p_temp text, p_qty int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('menuItemId', p_item, 'temperature', p_temp, 'quantity', p_qty));
$$;

select plan(41);

update public.store_settings set is_open = true, is_accepting_orders = true, pending_payment_ttl_minutes = 15;
-- Extra menu rows: no temperature choice and free (zero-amount order), inactive, archived, in an inactive category.
insert into public.menu_categories (id, name, sort_order, is_active)
  values ('00000000-0000-4000-8000-000000000f99', '테스트 숨김', 99, false);
insert into public.menu_items (id, category_id, name, price, temperatures, is_active, archived_at) values
  ('00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-000000000105', '무료 시식', 0, '{}', true, null),
  ('00000000-0000-4000-8000-000000000f02', '00000000-0000-4000-8000-000000000105', '비활성', 1000, '{HOT}', false, null),
  ('00000000-0000-4000-8000-000000000f03', '00000000-0000-4000-8000-000000000105', '보관됨', 1000, '{HOT}', true, now()),
  ('00000000-0000-4000-8000-000000000f04', '00000000-0000-4000-8000-000000000f99', '숨김 카테고리 메뉴', 1000, '{HOT}', true, null),
  ('00000000-0000-4000-8000-000000000f05', '00000000-0000-4000-8000-000000000105', '온도 없는 빵', 3000, '{}', true, null);

-- ===== anon =====
select t_anon();
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000001', 'TAKEOUT',
  '[]'::jsonb, null, 0, 'CARD', null)$$, '42501', null, 'anon cannot create a checkout order');
select throws_ok($$select public.quote_checkout('[]'::jsonb)$$, '42501', null, 'anon cannot quote');
select t_owner();

-- ===== customer1: happy path, server-side pricing, snapshots =====
select t_as('00000000-0000-4000-8000-0000000000c1');
select set_config('t.r1', public.create_checkout_order('a0000000-0000-4000-8000-000000000011', 'DINE_IN',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":2,"unitPrice":1,"price":1,"total":1},
    {"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1},
    {"menuItemId":"00000000-0000-4000-8000-000000000203","temperature":"ICE","quantity":1}]'::jsonb,
  null, 0, 'CARD', '  덜 달게 해주세요  ')::text, true);
select is((current_setting('t.r1')::jsonb ->> 'amount')::int, 4500 * 3 + 5000,
  'PAY-01 total is recomputed from menu prices; client-sent price fields are ignored and equal lines merge');
select is(current_setting('t.r1')::jsonb ->> 'status', 'PENDING_PAYMENT', 'a new order is PENDING_PAYMENT');
select is(current_setting('t.r1')::jsonb ->> 'paymentStatus', 'READY', 'its payment is READY');
select is(current_setting('t.r1')::jsonb ->> 'orderNumber', null, 'no order number before payment');
select is((select count(*) from public.order_items where order_id = (current_setting('t.r1')::jsonb ->> 'orderId')::uuid),
  2::bigint, 'duplicate lines were merged into 2 snapshot rows');
select is((select quantity from public.order_items where order_id = (current_setting('t.r1')::jsonb ->> 'orderId')::uuid
  and temperature = 'HOT'), 3, 'merged quantity');
select is((select note from public.orders where id = (current_setting('t.r1')::jsonb ->> 'orderId')::uuid),
  '덜 달게 해주세요', 'ORD-10 note is trimmed and stored');
select ok((select expires_at between now() + interval '14 minutes' and now() + interval '16 minutes'
  from public.orders where id = (current_setting('t.r1')::jsonb ->> 'orderId')::uuid),
  'OQ-14 the unpaid lifetime is the 15 minute store setting');
select is((select count(*) from public.order_status_history where order_id = (current_setting('t.r1')::jsonb ->> 'orderId')::uuid
  and from_status is null and to_status = 'PENDING_PAYMENT' and actor_role = 'CUSTOMER'), 1::bigint,
  'creation writes one history row');

-- ===== idempotency =====
select is(public.create_checkout_order('a0000000-0000-4000-8000-000000000011', 'DINE_IN',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":2,"unitPrice":1,"price":1,"total":1},
    {"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1},
    {"menuItemId":"00000000-0000-4000-8000-000000000203","temperature":"ICE","quantity":1}]'::jsonb,
  null, 0, 'CARD', '  덜 달게 해주세요  ') - 'isReplay',
  current_setting('t.r1')::jsonb - 'isReplay', 'a repeated request returns the same order and payment');
select is((public.create_checkout_order('a0000000-0000-4000-8000-000000000011', 'DINE_IN',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":2,"unitPrice":1,"price":1,"total":1},
    {"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1},
    {"menuItemId":"00000000-0000-4000-8000-000000000203","temperature":"ICE","quantity":1}]'::jsonb,
  null, 0, 'CARD', '  덜 달게 해주세요  ') ->> 'isReplay')::boolean, true, 'the replay is flagged');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000011', 'DINE_IN',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":9}]'::jsonb, null, 0, 'CARD', null)$$,
  'P0001', 'IDEMPOTENCY_CONFLICT', 'the same key with a different request is a conflict');
select t_owner();
select is((select count(*) from public.orders where client_request_id = 'a0000000-0000-4000-8000-000000000011'),
  1::bigint, 'double tap / retry created exactly one order');
select is((select count(*) from public.payments where order_id = (current_setting('t.r1')::jsonb ->> 'orderId')::uuid),
  1::bigint, 'and exactly one payment');

-- The same key from another customer is a different order.
select t_as('00000000-0000-4000-8000-0000000000c2');
select isnt(public.create_checkout_order('a0000000-0000-4000-8000-000000000011', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'ICE', 1), null, 0, 'CARD', null) ->> 'orderId',
  current_setting('t.r1')::jsonb ->> 'orderId', 'idempotency keys are per customer');
select t_owner();

-- ===== validation =====
select t_as('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000021', 'TAKEOUT', '[]'::jsonb, null, 0, 'CARD', null)$$,
  'P0001', 'EMPTY_CART', 'an empty cart is rejected');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000022', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 0), null, 0, 'CARD', null)$$, 'P0001', 'INVALID_QUANTITY', 'quantity 0');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000023', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 21), null, 0, 'CARD', null)$$, 'P0001', 'INVALID_QUANTITY', 'quantity 21');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000024', 'TAKEOUT',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":12},
    {"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":12}]'::jsonb, null, 0, 'CARD', null)$$,
  'P0001', 'INVALID_QUANTITY', 'merged quantity above 20');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000025', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000204', 'HOT', 1), null, 0, 'CARD', null)$$, 'P0001', 'ITEM_SOLD_OUT', 'sold-out item');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000026', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000f02', 'HOT', 1), null, 0, 'CARD', null)$$, 'P0001', 'ITEM_UNAVAILABLE', 'hidden (inactive) item');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000027', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000f03', 'HOT', 1), null, 0, 'CARD', null)$$, 'P0001', 'ITEM_UNAVAILABLE', 'archived item');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000028', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000f04', 'HOT', 1), null, 0, 'CARD', null)$$, 'P0001', 'ITEM_UNAVAILABLE', 'item in an inactive category');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000029', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000999', 'HOT', 1), null, 0, 'CARD', null)$$, 'P0001', 'ITEM_UNAVAILABLE', 'unknown item');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-00000000002a', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000202', 'HOT', 1), null, 0, 'CARD', null)$$, 'P0001', 'INVALID_TEMPERATURE', 'temperature the item is not sold in');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-00000000002b', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000f05', 'HOT', 1), null, 0, 'CARD', null)$$, 'P0001', 'INVALID_TEMPERATURE', 'temperature on an item without choices');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-00000000002c', 'TAKEOUT',
  '{"not":"an array"}'::jsonb, null, 0, 'CARD', null)$$, 'P0001', 'INVALID_INPUT', 'malformed lines');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-00000000002d', 'TAKEOUT',
  '[{"menuItemId":"nope","temperature":"HOT","quantity":1}]'::jsonb, null, 0, 'CARD', null)$$, 'P0001', 'INVALID_INPUT', 'malformed item id');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-00000000002e', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 1), null, 0, 'CARD', repeat('가', 101))$$,
  'P0001', 'NOTE_TOO_LONG', 'note longer than 100 characters');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-00000000002f', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 1), 'a0000000-0000-4000-8000-0000000000ff', 0, 'CARD', null)$$,
  'P0001', 'COUPON_NOT_USABLE', 'RW-04 an unknown coupon id is not usable');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000030', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 1), null, 10000000, 'CARD', null)$$,
  'P0001', 'POINTS_EXCEED_BALANCE', 'PAY-03 points beyond the balance are rejected');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000031', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 1), null, 0, 'NONE', null)$$,
  'P0001', 'INVALID_INPUT', 'payment method NONE is only for zero-amount orders');
select is((select count(*) from public.quote_checkout(public.t_line('00000000-0000-4000-8000-000000000f05', null, 2))),
  1::bigint, 'quote works for an item without temperature');
select is((public.quote_checkout(public.t_line('00000000-0000-4000-8000-000000000201', 'ICE', 2)) ->> 'paidAmount')::int,
  9000, 'quote_checkout recomputes from menu prices');
select t_owner();

-- ===== store status =====
update public.store_settings set is_accepting_orders = false;
select t_as('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000041', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 1), null, 0, 'CARD', null)$$,
  'P0001', 'NOT_ACCEPTING_ORDERS', 'orders paused');
select t_owner();
update public.store_settings set is_open = false;
select t_as('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.create_checkout_order('a0000000-0000-4000-8000-000000000042', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 1), null, 0, 'CARD', null)$$,
  'P0001', 'STORE_CLOSED', 'store closed');
select t_owner();
update public.store_settings set is_open = true, is_accepting_orders = true;

-- ===== zero-amount order (OQ-18) =====
select t_as('00000000-0000-4000-8000-0000000000c1');
select set_config('t.zero', public.create_checkout_order('a0000000-0000-4000-8000-000000000051', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000f01', null, 1), null, 0, 'CARD', null)::text, true);
select t_owner();
select is((select row(status, payment_status, payment_method, paid_amount)::text from public.orders
  where id = (current_setting('t.zero')::jsonb ->> 'orderId')::uuid), '(PAID,PAID,NONE,0)',
  'OQ-18 a zero-amount order is paid immediately with method NONE and no provider call');
select ok((select order_number ~ '^A-[0-9]+$' from public.orders where id = (current_setting('t.zero')::jsonb ->> 'orderId')::uuid),
  'and gets an order number');

-- ===== lazy expiry of the caller's stale orders =====
update public.orders set expires_at = now() - interval '1 minute' where id = (current_setting('t.r1')::jsonb ->> 'orderId')::uuid;
select t_as('00000000-0000-4000-8000-0000000000c1');
select public.create_checkout_order('a0000000-0000-4000-8000-000000000061', 'TAKEOUT',
  public.t_line('00000000-0000-4000-8000-000000000201', 'HOT', 1), null, 0, 'CARD', null);
select t_owner();
select is((select row(status, payment_status, cancel_reason)::text from public.orders
  where id = (current_setting('t.r1')::jsonb ->> 'orderId')::uuid), '(CANCELLED,CANCELLED,EXPIRED)',
  'a new checkout expires the same customer''s overdue unpaid order');

select * from finish();
rollback;
