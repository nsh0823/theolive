-- Phase (f) Store Admin sales aggregates and 회원관리 (plan sections 3.2, 11; SA-01, SA-02, SA-12).
-- Requirements: sales are paid minus refunded for the Asia/Seoul business day, excluding unpaid, cancelled and
-- rejected orders; members data is admin-only and arrives already masked; Olive Stamps and Coupon Points stay in
-- separate ledgers.
-- Everything runs with members created here (ids d1, d2), orders back-dated to May 2037 and a nickname prefix
-- (QTAP) no other suite uses, and every assertion looks only at those, so rows committed by other suites (API
-- integration runs, the seed) never change the result.
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

-- d1 logs in with Kakao and has a phone number, d2 uses an email login without one.
insert into auth.users (id, instance_id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'qtaphana@example.test', '+821012345678', '{"provider":"kakao","providers":["kakao"]}', '{"nickname":"QTAP김하나"}'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'qtapdul@example.test', null, '{"provider":"email","providers":["email"]}', '{"nickname":"QTAP이둘"}');

create function public.t_lines(p_americano int, p_latte int) returns jsonb language sql as $$
  select coalesce(jsonb_agg(l), '[]'::jsonb) from (
    select jsonb_build_object('menuItemId', '00000000-0000-4000-8000-000000000201', 'temperature', 'HOT', 'quantity', p_americano) l
      where p_americano > 0
    union all
    select jsonb_build_object('menuItemId', '00000000-0000-4000-8000-000000000203', 'temperature', 'ICE', 'quantity', p_latte)
      where p_latte > 0) x;
$$;
create function public.t_order(p_uid text, p_lines jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as(p_uid);
  r := public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', p_lines, null, 0, 'CARD', null);
  perform public.t_owner();
  return r;
end $$;
create function public.t_pay(p_order uuid) returns jsonb language sql as $$
  select public.apply_payment_result(p.id, 'APPROVED', 'tp-' || p.id, p.amount, 'ev-' || p.id, 'CONFIRM')
    from public.payments p where p.order_id = p_order;
$$;
create function public.t_staff(p_order uuid, p_action text, p_reason_code text default null) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as('00000000-0000-4000-8000-0000000000b2');
  r := public.staff_transition_order(p_order, p_action,
    (select status from public.orders where id = p_order), p_reason_code, null);
  perform public.t_owner();
  return r;
end $$;
create function public.t_oid(p_order jsonb) returns uuid language sql as $$ select (p_order ->> 'orderId')::uuid $$;
-- Moves a paid order to a given instant (the business day follows paid_at).
create function public.t_paid_at(p_order uuid, p_at timestamptz) returns void language sql as $$
  update public.orders set paid_at = p_at where id = p_order;
$$;
create function public.t_paid(p_order uuid) returns integer language sql as $$
  select paid_amount from public.orders where id = p_order;
$$;
create function public.t_day(p_summary jsonb, p_date text) returns jsonb language sql as $$
  select d from jsonb_array_elements(p_summary -> 'days') d where d ->> 'date' = p_date;
$$;

select plan(70);

update public.store_settings set is_open = true, is_accepting_orders = true, pending_payment_ttl_minutes = 15;

-- A: d1, 23:59:59 KST on May 1.  B: d1, 00:00:00 KST on May 2 (one second later).  C: d2, May 2 noon KST, partly
-- refunded.  D: rejected and refunded.  E: unpaid.  F: cancelled before payment.  G: paid, then cancelled and refunded.
select set_config('t.a', public.t_order('00000000-0000-4000-8000-0000000000d1', public.t_lines(1, 1))::text, true);
select set_config('t.b', public.t_order('00000000-0000-4000-8000-0000000000d1', public.t_lines(2, 0))::text, true);
select set_config('t.c', public.t_order('00000000-0000-4000-8000-0000000000d2', public.t_lines(0, 3))::text, true);
select set_config('t.d', public.t_order('00000000-0000-4000-8000-0000000000d2', public.t_lines(5, 0))::text, true);
select set_config('t.e', public.t_order('00000000-0000-4000-8000-0000000000d2', public.t_lines(4, 0))::text, true);
select set_config('t.f', public.t_order('00000000-0000-4000-8000-0000000000d2', public.t_lines(6, 0))::text, true);
select set_config('t.g', public.t_order('00000000-0000-4000-8000-0000000000d2', public.t_lines(7, 0))::text, true);
select public.t_pay(public.t_oid(current_setting('t.a')::jsonb));
select public.t_pay(public.t_oid(current_setting('t.b')::jsonb));
select public.t_pay(public.t_oid(current_setting('t.c')::jsonb));
select public.t_pay(public.t_oid(current_setting('t.d')::jsonb));
select public.t_pay(public.t_oid(current_setting('t.g')::jsonb));
select t_as('00000000-0000-4000-8000-0000000000d2');
select public.customer_cancel_order(public.t_oid(current_setting('t.f')::jsonb), 'PENDING_PAYMENT');
select public.customer_cancel_order(public.t_oid(current_setting('t.g')::jsonb), 'PAID');
select t_owner();
select public.t_staff(public.t_oid(current_setting('t.d')::jsonb), 'REJECT', 'SOLD_OUT');
select public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = public.t_oid(current_setting('t.d')::jsonb)), true, 'rf-d', null);
select public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = public.t_oid(current_setting('t.g')::jsonb)), true, 'rf-g', null);
-- C: a 1,000 won partial refund that succeeded.
insert into public.refunds (payment_id, amount, reason, status, idempotency_key, completed_at)
select p.id, 1000, 'T partial', 'SUCCEEDED', 'refund:partial:' || p.id, now()
  from public.payments p where p.order_id = public.t_oid(current_setting('t.c')::jsonb);
update public.payments set status = 'PARTIAL_REFUNDED' where order_id = public.t_oid(current_setting('t.c')::jsonb);
update public.orders set payment_status = 'PARTIAL_REFUNDED' where id = public.t_oid(current_setting('t.c')::jsonb);
select public.t_staff(public.t_oid(current_setting('t.a')::jsonb), 'ACCEPT');
select public.t_staff(public.t_oid(current_setting('t.a')::jsonb), 'START_PREPARING');
select public.t_staff(public.t_oid(current_setting('t.a')::jsonb), 'MARK_READY');
select public.t_staff(public.t_oid(current_setting('t.a')::jsonb), 'COMPLETE');
select public.t_paid_at(public.t_oid(current_setting('t.a')::jsonb), timestamptz '2037-05-01 14:59:59+00');
select public.t_paid_at(public.t_oid(current_setting('t.b')::jsonb), timestamptz '2037-05-01 15:00:00+00');
select public.t_paid_at(public.t_oid(current_setting('t.c')::jsonb), timestamptz '2037-05-02 03:00:00+00');
select public.t_paid_at(public.t_oid(current_setting('t.d')::jsonb), timestamptz '2037-05-02 04:00:00+00');
select public.t_paid_at(public.t_oid(current_setting('t.g')::jsonb), timestamptz '2037-05-02 05:00:00+00');
select is((select status::text from public.orders where id = public.t_oid(current_setting('t.d')::jsonb)), 'REJECTED', 'setup: D is rejected');
select is((select status::text from public.orders where id = public.t_oid(current_setting('t.g')::jsonb)), 'CANCELLED', 'setup: G is cancelled after payment');
select is((select payment_status::text from public.orders where id = public.t_oid(current_setting('t.g')::jsonb)), 'REFUNDED', 'setup: G is refunded');
select is((select status::text from public.orders where id = public.t_oid(current_setting('t.e')::jsonb)), 'PENDING_PAYMENT', 'setup: E is unpaid');

-- ===== sales (SA-01, SA-02) =====
select t_as('00000000-0000-4000-8000-0000000000a1');
select set_config('t.s', public.admin_sales_summary(date '2037-04-30', date '2037-05-03')::text, true);
select is(jsonb_array_length(current_setting('t.s')::jsonb -> 'days'), 4, 'one entry per day of the range, including empty days');
select is(public.t_day(current_setting('t.s')::jsonb, '2037-04-30'), '{"date": "2037-04-30", "sales": 0, "orderCount": 0}'::jsonb, 'an empty day is zero');
select is((public.t_day(current_setting('t.s')::jsonb, '2037-05-01') ->> 'sales')::int, public.t_paid(public.t_oid(current_setting('t.a')::jsonb)),
  'May 1 holds the order paid at 23:59:59 KST');
select is((public.t_day(current_setting('t.s')::jsonb, '2037-05-01') ->> 'orderCount')::int, 1, 'and counts it once');
select is((public.t_day(current_setting('t.s')::jsonb, '2037-05-02') ->> 'sales')::int,
  public.t_paid(public.t_oid(current_setting('t.b')::jsonb)) + public.t_paid(public.t_oid(current_setting('t.c')::jsonb)) - 1000,
  'May 2 starts at 00:00:00 KST (B), counts C net of its 1,000 won refund, and has no D, E, F or G');
select is((public.t_day(current_setting('t.s')::jsonb, '2037-05-02') ->> 'orderCount')::int, 2, 'two counted orders on May 2');
select is((public.t_day(current_setting('t.s')::jsonb, '2037-05-03') ->> 'sales')::int, 0, 'May 3 is empty');
select is((current_setting('t.s')::jsonb ->> 'total')::int,
  public.t_paid(public.t_oid(current_setting('t.a')::jsonb)) + public.t_paid(public.t_oid(current_setting('t.b')::jsonb))
  + public.t_paid(public.t_oid(current_setting('t.c')::jsonb)) - 1000, 'total = paid minus refunded');
select is((current_setting('t.s')::jsonb ->> 'orderCount')::int, 3, 'three orders counted (rejected, cancelled, refunded and unpaid are not)');
select is((current_setting('t.s')::jsonb ->> 'averageAmount')::int, ((current_setting('t.s')::jsonb ->> 'total')::int / 3.0)::numeric(12, 0)::int, 'the average is the rounded total / orders');
select is((public.admin_sales_summary(date '2037-05-01', date '2037-05-01') ->> 'total')::int, public.t_paid(public.t_oid(current_setting('t.a')::jsonb)),
  'a one-day range works');
select is(public.admin_sales_summary(date '2037-06-01', date '2037-06-03') #>> '{averageAmount}', '0', 'no orders: average 0, not a division error');
select throws_ok($$select public.admin_sales_summary(date '2037-05-03', date '2037-05-01')$$, 'P0001', 'INVALID_INPUT', 'from after to is invalid');
select throws_ok($$select public.admin_sales_summary(date '2036-01-01', date '2037-05-01')$$, 'P0001', 'INVALID_INPUT', 'a range over a year is invalid');
select throws_ok($$select public.admin_sales_summary(null, date '2037-05-01')$$, 'P0001', 'INVALID_INPUT', 'a missing date is invalid');

select set_config('t.p', public.admin_popular_items(date '2037-05-01', date '2037-05-02', 5)::text, true);
select is(current_setting('t.p')::jsonb, '[{"name": "카페 라떼", "quantity": 4}, {"name": "아메리카노", "quantity": 3}]'::jsonb,
  'popular items count only the counted orders, most sold first');
select is(public.admin_popular_items(date '2037-05-01', date '2037-05-02', 1), '[{"name": "카페 라떼", "quantity": 4}]'::jsonb, 'the limit applies');
select is(public.admin_popular_items(date '2037-05-02', date '2037-05-02', 5), '[{"name": "카페 라떼", "quantity": 3}, {"name": "아메리카노", "quantity": 2}]'::jsonb,
  'and so does the day range');
select is(public.admin_popular_items(date '2037-06-01', date '2037-06-02', 5), '[]'::jsonb, 'no sales: an empty list');

-- sales access
select t_as('00000000-0000-4000-8000-0000000000b1');
select throws_ok($$select public.admin_sales_summary(date '2037-05-01', date '2037-05-02')$$, 'P0001', 'FORBIDDEN', 'staff with every permission cannot read sales');
select throws_ok($$select public.admin_popular_items(date '2037-05-01', date '2037-05-02', 5)$$, 'P0001', 'FORBIDDEN', 'nor popular items');
select t_as('00000000-0000-4000-8000-0000000000b3');
select throws_ok($$select public.admin_sales_summary(date '2037-05-01', date '2037-05-02')$$, 'P0001', 'FORBIDDEN', 'inactive staff cannot either');
select t_as('00000000-0000-4000-8000-0000000000d1');
select throws_ok($$select public.admin_sales_summary(date '2037-05-01', date '2037-05-02')$$, 'P0001', 'FORBIDDEN', 'a customer cannot');
select t_anon();
select throws_ok($$select public.admin_sales_summary(date '2037-05-01', date '2037-05-02')$$, '42501', null, 'anon cannot');
select throws_ok($$select * from private.counted_orders$$, '42501', null, 'anon cannot read the counting view');
select t_as('00000000-0000-4000-8000-0000000000d1');
select throws_ok($$select * from private.counted_orders$$, '42501', null, 'neither can a customer');
select t_owner();

-- ===== members (SA-12) =====
select public.t_staff(public.t_oid(current_setting('t.c')::jsonb), 'ACCEPT');
select public.t_staff(public.t_oid(current_setting('t.c')::jsonb), 'START_PREPARING');
select public.t_staff(public.t_oid(current_setting('t.c')::jsonb), 'MARK_READY');
insert into public.coupon_point_code_batches (id, amount, quantity, expires_at, memo)
values ('00000000-0000-4000-8000-000000000d51', 4000, 1, now() + interval '400 days', 'pgTAP');
insert into public.coupon_point_codes (id, batch_id, code, amount, expires_at)
values ('00000000-0000-4000-8000-000000000d52', '00000000-0000-4000-8000-000000000d51', 'OLIVE-MBR1-AAA1', 4000, now() + interval '90 days');
select private.register_point_code('00000000-0000-4000-8000-0000000000d1', 'OLIVE-MBR1-AAA1');
select set_config('t.mp', private.mask_phone('+821012345678'), true);

select t_as('00000000-0000-4000-8000-0000000000a1');
select set_config('t.m', public.admin_list_members('QTAP')::text, true);
select is((current_setting('t.m')::jsonb ->> 'total')::int, 2, 'admin: the search finds both test members');
select is((select array_agg(i ->> 'nickname' order by i ->> 'nickname') from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i),
  array['QTAP김하나', 'QTAP이둘'], 'by nickname');
select is((select i ->> 'maskedEmail' from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP김하나'),
  'qtap***@example.test', 'the email arrives masked');
select is((select i ->> 'maskedPhone' from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP김하나'),
  current_setting('t.mp'), 'the phone arrives masked');
select is((select i -> 'maskedPhone' from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP이둘'),
  'null'::jsonb, 'no phone on file: null');
select is((select i ->> 'provider' from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP김하나'), 'KAKAO', 'login provider');
select is((select i ->> 'provider' from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP이둘'), 'EMAIL', 'an email login is EMAIL');
select ok(position('qtaphana@example.test' in current_setting('t.m')) = 0 and position('qtapdul' in current_setting('t.m')) = 0
  and position('12345678' in current_setting('t.m')) = 0, 'the list never contains a raw email or phone number');
select is((select (i ->> 'orderCount')::int from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP김하나'), 2,
  'order count = counted orders (A and B)');
select is((select (i ->> 'totalSpent')::int from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP김하나'),
  public.t_paid(public.t_oid(current_setting('t.a')::jsonb)) + public.t_paid(public.t_oid(current_setting('t.b')::jsonb)), 'total spent');
select is((select (i ->> 'totalSpent')::int from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP이둘'),
  public.t_paid(public.t_oid(current_setting('t.c')::jsonb)) - 1000, 'a refund lowers what the other member spent; rejected, cancelled and unpaid orders add nothing');
select is((select (i ->> 'lastOrderAt')::timestamptz from jsonb_array_elements(current_setting('t.m')::jsonb -> 'items') i where i ->> 'nickname' = 'QTAP김하나'),
  timestamptz '2037-05-01 15:00:00+00', 'last order = newest paid_at');
select is((public.admin_list_members('qtap이') ->> 'total')::int, 1, 'the nickname search ignores case and matches part of a name');
select is((public.admin_list_members('qtaphana') ->> 'total')::int, 0, 'the email is not searchable');
select is((public.admin_list_members('12345678') ->> 'total')::int, 0, 'neither is the phone number');
select is((public.admin_list_members('%') ->> 'total')::int, 0, 'wildcards match literally');
select is((public.admin_list_members((select order_number from public.orders where id = public.t_oid(current_setting('t.c')::jsonb))) -> 'items') @> '[{"nickname": "QTAP이둘"}]'::jsonb,
  true, 'an order number finds its customer');
select is((public.admin_list_members('김올리') ->> 'total')::int, 0, 'staff accounts are not members');
select is(jsonb_array_length(public.admin_list_members('QTAP', 1, 0) -> 'items'), 1, 'paging: one per page');
select is((public.admin_list_members('QTAP', 1, 1) -> 'items' -> 0 ->> 'nickname') <> (public.admin_list_members('QTAP', 1, 0) -> 'items' -> 0 ->> 'nickname'), true, 'the next page is a different member');
select is((public.admin_list_members('QTAP', 1, 1) ->> 'total')::int, 2, 'and the total does not depend on the page');

select set_config('t.d1', public.admin_get_member('00000000-0000-4000-8000-0000000000d1')::text, true);
select is(current_setting('t.d1')::jsonb ->> 'maskedEmail', 'qtap***@example.test', 'detail: masked email');
select ok(position('qtaphana@example.test' in current_setting('t.d1')) = 0 and position('12345678' in current_setting('t.d1')) = 0,
  'detail: no raw email or phone anywhere');
select is((current_setting('t.d1')::jsonb ->> 'stampBalance')::int, 1, 'detail: stamp balance (A completed)');
select is((current_setting('t.d1')::jsonb ->> 'pointBalance')::int, 4000, 'detail: point balance, a separate number');
select is((select array_agg(e ->> 'kind') from jsonb_array_elements(current_setting('t.d1')::jsonb -> 'stampLedger') e), array['EARN'], 'the stamp ledger holds only stamp rows');
select is((select array_agg(e ->> 'kind') from jsonb_array_elements(current_setting('t.d1')::jsonb -> 'pointLedger') e), array['REGISTER'], 'the point ledger holds only point rows');
select is((current_setting('t.d1')::jsonb -> 'pointLedger' -> 0 ->> 'delta')::int, 4000, 'with its own amounts');
select is((select array_agg(e ->> 'id' order by e ->> 'id') from jsonb_array_elements(current_setting('t.d1')::jsonb -> 'orders') e),
  (select array_agg(id::text order by id::text) from public.orders where id in (public.t_oid(current_setting('t.a')::jsonb), public.t_oid(current_setting('t.b')::jsonb))),
  'detail: the paid orders, nothing unpaid');
select is((current_setting('t.d1')::jsonb -> 'orders' -> 0 ->> 'id')::uuid, public.t_oid(current_setting('t.b')::jsonb), 'newest first');
select throws_ok($$select public.admin_get_member('00000000-0000-4000-8000-0000000000ee')$$, 'P0001', 'NOT_FOUND', 'an unknown member is NOT_FOUND');
select throws_ok($$select public.admin_get_member('00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'NOT_FOUND', 'a staff account is not a member');

select t_as('00000000-0000-4000-8000-0000000000b1');
select throws_ok($$select public.admin_list_members('QTAP')$$, 'P0001', 'FORBIDDEN', 'staff with every permission cannot list members');
select throws_ok($$select public.admin_get_member('00000000-0000-4000-8000-0000000000d1')$$, 'P0001', 'FORBIDDEN', 'nor open one');
select t_as('00000000-0000-4000-8000-0000000000b2');
select throws_ok($$select public.admin_list_members('QTAP')$$, 'P0001', 'FORBIDDEN', 'a barista cannot');
select t_as('00000000-0000-4000-8000-0000000000d2');
select throws_ok($$select public.admin_list_members('QTAP')$$, 'P0001', 'FORBIDDEN', 'a customer cannot list members');
select throws_ok($$select public.admin_get_member('00000000-0000-4000-8000-0000000000d1')$$, 'P0001', 'FORBIDDEN', 'nor read another customer');
select is((select count(*) from public.profiles where id <> '00000000-0000-4000-8000-0000000000d2'), 0::bigint, 'and the profiles table still shows only their own row');
select t_anon();
select throws_ok($$select public.admin_list_members('QTAP')$$, '42501', null, 'anon cannot list members');
select throws_ok($$select public.admin_get_member('00000000-0000-4000-8000-0000000000d1')$$, '42501', null, 'anon cannot open one');
select t_owner();

select * from finish();
rollback;
