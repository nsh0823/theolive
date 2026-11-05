-- Phase (d) Olive Stamps and reward coupons (plan sections 1.8, 3.1, 5.1, 5.2, 5.4, 11.1, 11.4).
-- Requirements: RW-01 (earn), RW-02 (exchange), RW-03/04 (coupon list and use), PAY-02 (coupon at checkout), SA-07 (policy).
-- Everything runs with members created here (ids e1..e6) and definitions created here, and every assertion looks only
-- at their rows, so rows committed by other suites (API integration runs, seeds) never change the result.
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

-- Members: e1 coupons at checkout, e2 earn and policy, e3 refund reversal, e4 reversal shortfall, e5 exchange, e6 outsider.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('00000000-0000-4000-8000-0000000000e' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'reward' || n || '@example.test', '{}'
  from generate_series(1, 6) n;

-- Fixtures: seeded americano 201 (4500), latte 203 (5000), scone 209 (3800, dessert category 105).
create function public.t_lines(p_americano int, p_latte int) returns jsonb language sql as $$
  select coalesce(jsonb_agg(l), '[]'::jsonb) from (
    select jsonb_build_object('menuItemId', '00000000-0000-4000-8000-000000000201', 'temperature', 'HOT', 'quantity', p_americano) l
      where p_americano > 0
    union all
    select jsonb_build_object('menuItemId', '00000000-0000-4000-8000-000000000203', 'temperature', 'ICE', 'quantity', p_latte)
      where p_latte > 0) x;
$$;

-- Checkout through the real RPC as the member; returns the result row.
create function public.t_order(p_uid text, p_lines jsonb, p_coupon uuid default null, p_req uuid default gen_random_uuid())
returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as(p_uid);
  r := public.create_checkout_order(p_req, 'TAKEOUT', p_lines, p_coupon, 0, 'CARD', null);
  perform public.t_owner();
  return r;
end $$;

-- A verified provider approval for the order's payment (amount read from the payment row).
create function public.t_pay(p_order uuid) returns jsonb language sql as $$
  select public.apply_payment_result(p.id, 'APPROVED', 'tp-' || p.id, p.amount, 'ev-' || p.id, 'CONFIRM')
    from public.payments p where p.order_id = p_order;
$$;

-- Staff action as the barista (PROCESS_ORDERS), with the status the board currently shows.
create function public.t_staff(p_order uuid, p_action text, p_reason_code text default null) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as('00000000-0000-4000-8000-0000000000b2');
  r := public.staff_transition_order(p_order, p_action,
    (select status from public.orders where id = p_order), p_reason_code, null);
  perform public.t_owner();
  return r;
end $$;

create function public.t_complete(p_order uuid) returns void language plpgsql as $$
begin
  perform public.t_staff(p_order, 'ACCEPT');
  perform public.t_staff(p_order, 'START_PREPARING');
  perform public.t_staff(p_order, 'MARK_READY');
  perform public.t_staff(p_order, 'COMPLETE');
end $$;

create function public.t_paid_order(p_uid text, p_lines jsonb, p_coupon uuid default null) returns uuid language plpgsql as $$
declare r jsonb;
begin
  r := public.t_order(p_uid, p_lines, p_coupon);
  perform public.t_pay((r ->> 'orderId')::uuid);
  return (r ->> 'orderId')::uuid;
end $$;

-- Hands a member a coupon of a definition by crediting exactly the stamps it costs and exchanging them.
create function public.t_coupon(p_uid text, p_def uuid) returns uuid language plpgsql as $$
begin
  perform private.add_stamp_tx(p_uid::uuid, 'EARN',
    (select required_stamps from public.coupons where id = p_def), 'test credit', 'tg:' || gen_random_uuid());
  return (private.issue_coupon_for_stamps(p_uid::uuid, p_def, gen_random_uuid()) ->> 'userCouponId')::uuid;
end $$;

create function public.t_bal(p_uid text) returns integer language sql as $$
  select coalesce((select balance from public.stamp_balances where user_id = p_uid::uuid), 0);
$$;
create function public.t_sum(p_uid text) returns integer language sql as $$
  select coalesce((select sum(delta) from public.stamp_transactions where user_id = p_uid::uuid), 0)::integer;
$$;
create function public.t_cstatus(p_id uuid) returns text language sql as $$
  select status::text from public.user_coupons where id = p_id;
$$;

-- Rows an UPDATE of the exchange rules reaches for the current role (row-level security hides the rest).
create function public.t_coupon_updates() returns bigint language plpgsql as $$
declare n bigint;
begin
  update public.coupons set required_stamps = 1;
  get diagnostics n = row_count;
  return n;
end $$;

select plan(168);

update public.store_settings set is_open = true, is_accepting_orders = true, pending_payment_ttl_minutes = 15;

insert into public.coupons (id, title, required_stamps, valid_days, benefit_type, discount_amount,
  eligible_category_ids, eligible_menu_item_ids, is_active) values
  ('00000000-0000-4000-8000-000000000f31', 'T 아메리카노 또는 라떼', 3, 90, 'FREE_ITEM', null, '{}',
   '{00000000-0000-4000-8000-000000000201,00000000-0000-4000-8000-000000000203}', true),
  ('00000000-0000-4000-8000-000000000f32', 'T 상한 3000', 2, 30, 'FREE_ITEM', 3000, '{}', '{}', true),
  ('00000000-0000-4000-8000-000000000f33', 'T 정액 3000', 2, 30, 'FIXED_AMOUNT', 3000, '{}', '{}', true),
  ('00000000-0000-4000-8000-000000000f34', 'T 큰 정액', 2, 30, 'FIXED_AMOUNT', 100000, '{}', '{}', true),
  ('00000000-0000-4000-8000-000000000f35', 'T 디저트', 2, 30, 'FREE_ITEM', null,
   '{00000000-0000-4000-8000-000000000105}', '{}', true),
  ('00000000-0000-4000-8000-000000000f36', 'T 비활성', 2, 30, 'FREE_ITEM', null, '{}', '{}', false),
  ('00000000-0000-4000-8000-000000000f37', 'T 하나', 1, 30, 'FREE_ITEM', null, '{}', '{}', true),
  ('00000000-0000-4000-8000-000000000f38', 'T 교환 5', 5, 30, 'FREE_ITEM', null, '{}', '{}', true);

-- ===== stamp policy (SA-07, OQ-24) =====
select ok((select earn_timing = 'COMPLETED' from private.current_stamp_policy()), 'a policy is in force and earns at COMPLETED');
select cmp_ok((select count(*) from public.stamp_policies where earn_mode = 'PER_ORDER' and stamps_per_order = 1), '>=', 1::bigint,
  'the default policy (1 stamp per order) is part of the schema');
select throws_ok($$insert into public.stamp_policies (earn_mode, stamps_per_order, earn_timing) values ('PER_ORDER', 1, 'PAID')$$,
  '23514', null, 'OQ-24 the earn timing is fixed: another timing violates the table check');
select throws_ok($$update public.stamp_policies set stamps_per_order = 5$$, 'P0001', 'APPEND_ONLY', 'policies are append-only (update)');
select throws_ok($$delete from public.stamp_policies$$, 'P0001', 'APPEND_ONLY', 'policies are append-only (delete)');

select t_as('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$select public.admin_set_stamp_policy('PER_ORDER', 3::smallint, null, 'MENU_AMOUNT')$$, 'P0001', 'FORBIDDEN',
  'a customer cannot set the policy');
select t_as('00000000-0000-4000-8000-0000000000b1');
select throws_ok($$select public.admin_set_stamp_policy('PER_ORDER', 3::smallint, null, 'MENU_AMOUNT')$$, 'P0001', 'FORBIDDEN',
  'staff cannot set the policy');
select t_anon();
select throws_ok($$select public.admin_set_stamp_policy('PER_ORDER', 3::smallint, null, 'MENU_AMOUNT')$$, '42501', null,
  'anon cannot set the policy');
select t_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.admin_set_stamp_policy('PER_AMOUNT', null, 500, 'MENU_AMOUNT')$$, 'P0001', 'INVALID_INPUT',
  'a per-amount policy below 1,000 won is invalid');
select throws_ok($$select public.admin_set_stamp_policy('PER_AMOUNT', null, null, 'MENU_AMOUNT')$$, 'P0001', 'INVALID_INPUT',
  'a per-amount policy needs an amount');
select throws_ok($$select public.admin_set_stamp_policy('PER_ORDER', 11::smallint, null, 'MENU_AMOUNT')$$, 'P0001', 'INVALID_INPUT',
  'more than 10 stamps per order is invalid');
select throws_ok($$select public.admin_set_stamp_policy('PER_ORDER', 1::smallint, null, 'BOGUS')$$, 'P0001', 'INVALID_INPUT',
  'an unknown basis is invalid');
select is(public.admin_set_stamp_policy('PER_ORDER', 1::smallint, null, 'MENU_AMOUNT') ->> 'createdBy', null,
  'a valid policy is saved (the key name is the column, created_by)');
select t_owner();
select is((select created_by::text from private.current_stamp_policy()), '00000000-0000-4000-8000-0000000000a1',
  'and records who saved it');

-- ===== earn on COMPLETED only, once per order (RW-01, OQ-23) =====
select set_config('t.e2o1', public.t_paid_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-0000000000e2'), 0::bigint,
  'no stamp when the order is merely PAID');
select ok((select stamp_policy_id = (select id from private.current_stamp_policy()) from public.orders where id = current_setting('t.e2o1')::uuid),
  'the policy in force is snapshotted on the order at payment');
select public.t_staff(current_setting('t.e2o1')::uuid, 'ACCEPT');
select public.t_staff(current_setting('t.e2o1')::uuid, 'START_PREPARING');
select public.t_staff(current_setting('t.e2o1')::uuid, 'MARK_READY');
select is(t_sum('00000000-0000-4000-8000-0000000000e2'), 0, 'no stamp while ACCEPTED, PREPARING or READY');
select public.t_staff(current_setting('t.e2o1')::uuid, 'COMPLETE');
select is(t_bal('00000000-0000-4000-8000-0000000000e2'), 1, 'completing the order earns 1 stamp');
select is((select row(kind, delta, balance_after, label, order_id)::text from public.stamp_transactions
  where user_id = '00000000-0000-4000-8000-0000000000e2'),
  '(EARN,1,1,"주문 적립",' || current_setting('t.e2o1') || ')', 'the ledger row is an EARN linked to the order');
select is(public.t_staff(current_setting('t.e2o1')::uuid, 'COMPLETE') ->> 'isReplay', 'true', 'repeating COMPLETE is a replay');
select lives_ok($$select private.earn_stamps_for_order(current_setting('t.e2o1')::uuid, 'COMPLETED')$$, 'a duplicate completion event is harmless');
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-0000000000e2'), 1::bigint,
  'RW-01 one stamp per order, even when the event repeats');

-- No earn on reject or cancel.
select set_config('t.e2o2', public.t_paid_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select public.t_staff(current_setting('t.e2o2')::uuid, 'REJECT', 'SOLD_OUT');
select set_config('t.e2o3', public.t_paid_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select t_as('00000000-0000-4000-8000-0000000000e2');
select public.customer_cancel_order(current_setting('t.e2o3')::uuid, 'PAID');
select t_owner();
select set_config('t.e2o4', (public.t_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0)) ->> 'orderId'), true);
select t_as('00000000-0000-4000-8000-0000000000e2');
select public.customer_cancel_order(current_setting('t.e2o4')::uuid, 'PENDING_PAYMENT');
select t_owner();
select is(t_bal('00000000-0000-4000-8000-0000000000e2'), 1, 'rejected and cancelled orders earn nothing');
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-0000000000e2' and kind = 'EARN'),
  1::bigint, 'and write no ledger row');

-- A policy change applies to orders paid after it only.
select set_config('t.e2old', public.t_paid_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select t_as('00000000-0000-4000-8000-0000000000a1');
select set_config('t.pol2', public.admin_set_stamp_policy('PER_ORDER', 2::smallint, null, 'MENU_AMOUNT')::text, true);
select t_owner();
select is((select earn_timing::text from public.stamp_policies where id = (current_setting('t.pol2')::jsonb ->> 'id')::uuid),
  'COMPLETED', 'a saved policy always has the fixed timing');
select is((select id::text from private.current_stamp_policy()), current_setting('t.pol2')::jsonb ->> 'id',
  'the newest policy is the current one');
select set_config('t.e2new', public.t_paid_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select t_complete(current_setting('t.e2old')::uuid);
select is(t_bal('00000000-0000-4000-8000-0000000000e2'), 2, 'SA-07 the order paid under the old policy earns the old amount');
select t_complete(current_setting('t.e2new')::uuid);
select is(t_bal('00000000-0000-4000-8000-0000000000e2'), 4, 'SA-07 the order paid after the change earns the new amount');

-- PER_AMOUNT: floor(menu amount / amount per stamp); a zero result writes no row.
select t_as('00000000-0000-4000-8000-0000000000a1');
select public.admin_set_stamp_policy('PER_AMOUNT', null, 2000, 'MENU_AMOUNT');
select t_owner();
select set_config('t.e2a', public.t_paid_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select t_complete(current_setting('t.e2a')::uuid);
select is(t_bal('00000000-0000-4000-8000-0000000000e2'), 6, 'per-amount earn is floor(4500 / 2000) = 2 stamps');
select t_as('00000000-0000-4000-8000-0000000000a1');
select public.admin_set_stamp_policy('PER_AMOUNT', null, 5000, 'MENU_AMOUNT');
select t_owner();
select set_config('t.e2b', public.t_paid_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select t_complete(current_setting('t.e2b')::uuid);
select is((select count(*) from public.stamp_transactions where order_id = current_setting('t.e2b')::uuid), 0::bigint,
  'a per-amount result of zero writes no ledger row');
select t_as('00000000-0000-4000-8000-0000000000a1');
select public.admin_set_stamp_policy('PER_ORDER', 1::smallint, null, 'MENU_AMOUNT');
select t_owner();
select is(t_bal('00000000-0000-4000-8000-0000000000e2'), t_sum('00000000-0000-4000-8000-0000000000e2'),
  'balance equals the ledger sum');

-- ===== exchange (RW-02) =====
select private.add_stamp_tx('00000000-0000-4000-8000-0000000000e5', 'EARN', 12, 'test credit', 'tg:e5');
select set_config('t.req1', gen_random_uuid()::text, true);
select t_as('00000000-0000-4000-8000-0000000000e5');
select set_config('t.x1', public.redeem_stamps_for_coupon('00000000-0000-4000-8000-000000000f38', current_setting('t.req1')::uuid)::text, true);
select t_owner();
select is((current_setting('t.x1')::jsonb ->> 'stampBalance')::int, 7, 'exchange with a sufficient balance returns the new balance');
select is(t_bal('00000000-0000-4000-8000-0000000000e5'), 7, 'and deducts the stamps');
select is((select row(title_snapshot, benefit_type_snapshot, status)::text from public.user_coupons
  where id = (current_setting('t.x1')::jsonb ->> 'userCouponId')::uuid), '("T 교환 5",FREE_ITEM,AVAILABLE)',
  'an AVAILABLE coupon is issued with the definition snapshot');
select ok((select expires_at > now() + interval '29 days' and expires_at <= now() + interval '31 days'
  and (expires_at at time zone 'Asia/Seoul')::time = '00:00'
  from public.user_coupons where id = (current_setting('t.x1')::jsonb ->> 'userCouponId')::uuid),
  'it expires at the end of the last valid day (midnight KST)');
select is((select row(kind, delta, label, user_coupon_id)::text from public.stamp_transactions
  where user_id = '00000000-0000-4000-8000-0000000000e5' and kind = 'REDEEM'),
  '(REDEEM,-5,"쿠폰 교환",' || (current_setting('t.x1')::jsonb ->> 'userCouponId') || ')', 'a REDEEM ledger row points at the coupon');
select ok((select redeem_transaction_id is not null from public.user_coupons
  where id = (current_setting('t.x1')::jsonb ->> 'userCouponId')::uuid), 'the coupon records its ledger row');

select t_as('00000000-0000-4000-8000-0000000000e5');
select is(public.redeem_stamps_for_coupon('00000000-0000-4000-8000-000000000f38', current_setting('t.req1')::uuid) ->> 'isReplay', 'true',
  'repeating the same request is a replay');
select throws_ok(format($$select public.redeem_stamps_for_coupon('00000000-0000-4000-8000-000000000f32', %L)$$, current_setting('t.req1')),
  'P0001', 'IDEMPOTENCY_CONFLICT', 'the same request id for another coupon is a conflict');
select t_owner();
select is(t_bal('00000000-0000-4000-8000-0000000000e5'), 7, 'a replay deducts nothing again');
select is((select count(*) from public.user_coupons where user_id = '00000000-0000-4000-8000-0000000000e5'), 1::bigint,
  'and issues no second coupon');

-- Second exchange fits (7 -> 2), a third does not: the "double exchange" can only succeed once per balance.
select t_as('00000000-0000-4000-8000-0000000000e5');
select is((public.redeem_stamps_for_coupon('00000000-0000-4000-8000-000000000f38', gen_random_uuid()) ->> 'stampBalance')::int, 2,
  'a second exchange with enough stamps works');
select throws_ok($$select public.redeem_stamps_for_coupon('00000000-0000-4000-8000-000000000f38', gen_random_uuid())$$,
  'P0001', 'INSUFFICIENT_STAMPS', 'an exchange with an insufficient balance is rejected');
select throws_ok($$select public.redeem_stamps_for_coupon('00000000-0000-4000-8000-000000000f36', gen_random_uuid())$$,
  'P0001', 'REWARD_INACTIVE', 'an inactive exchange rule is rejected');
select throws_ok($$select public.redeem_stamps_for_coupon('00000000-0000-4000-8000-000000000fff', gen_random_uuid())$$,
  'P0001', 'NOT_FOUND', 'an unknown rule is rejected');
select t_owner();
select is(t_bal('00000000-0000-4000-8000-0000000000e5'), 2, 'rejected exchanges change nothing');
select is((select count(*) from public.user_coupons where user_id = '00000000-0000-4000-8000-0000000000e5'), 2::bigint,
  'and issue no coupon');
select throws_ok($$select private.add_stamp_tx('00000000-0000-4000-8000-0000000000e5', 'REDEEM', -999, 'x', 'tg:overdraw')$$,
  'P0001', 'INSUFFICIENT_STAMPS', 'the ledger itself never lets a balance go negative');
select is(t_bal('00000000-0000-4000-8000-0000000000e5'), t_sum('00000000-0000-4000-8000-0000000000e5'),
  'balance equals the ledger sum after the exchanges');
select is(private.add_stamp_tx('00000000-0000-4000-8000-0000000000e5', 'EARN', 1, 'x', 'tg:e5'), null,
  'an existing idempotency key is a no-op');
select is(t_bal('00000000-0000-4000-8000-0000000000e5'), 2, 'and does not move the balance');

-- ===== coupon at checkout (RW-04, PAY-02, OQ-26, OQ-27) =====
select set_config('t.c1', public.t_coupon('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000f31')::text, true);
select t_as('00000000-0000-4000-8000-0000000000e1');
select set_config('t.q1', public.quote_checkout(public.t_lines(2, 1), current_setting('t.c1')::uuid)::text, true);
select t_owner();
select is((current_setting('t.q1')::jsonb ->> 'couponDiscount')::int, 5000,
  'quote: FREE_ITEM discounts the most expensive eligible unit price (latte 5000)');
select is((current_setting('t.q1')::jsonb ->> 'paidAmount')::int, 9000, 'quote: paid = 14000 - 5000, computed by the server');
select ok((current_setting('t.q1')::jsonb -> 'usableCouponIds') @> to_jsonb(array[current_setting('t.c1')]), 'quote lists the usable coupon');

select set_config('t.co1', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(2, 1), current_setting('t.c1')::uuid,
  'c0000000-0000-4000-8000-000000000001')::text, true);
select is((current_setting('t.co1')::jsonb ->> 'amount')::int, 9000, 'checkout: the payment amount already includes the coupon');
select is((current_setting('t.co1')::jsonb ->> 'couponDiscount')::int, 5000, 'checkout returns the server discount');
select is((select row(menu_amount, coupon_discount, paid_amount, user_coupon_id, coupon_title_snapshot)::text from public.orders
  where id = (current_setting('t.co1')::jsonb ->> 'orderId')::uuid),
  '(14000,5000,9000,' || current_setting('t.c1') || ',"T 아메리카노 또는 라떼")', 'the order stores the discount and the coupon snapshot');
select is(t_cstatus(current_setting('t.c1')::uuid), 'RESERVED', 'the coupon is RESERVED while the payment is open');
select is((select reserved_order_id::text from public.user_coupons where id = current_setting('t.c1')::uuid),
  current_setting('t.co1')::jsonb ->> 'orderId', 'and points at its order');
select is(public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(2, 1), current_setting('t.c1')::uuid,
  'c0000000-0000-4000-8000-000000000001') ->> 'isReplay', 'true', 'a checkout retry with the same key replays the order');
select is(t_cstatus(current_setting('t.c1')::uuid), 'RESERVED', 'and the coupon stays reserved once');
select throws_ok(format($$select public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0), %L)$$, current_setting('t.c1')),
  'P0001', 'COUPON_NOT_USABLE', 'a coupon reserved by an open checkout cannot start a second one');
select t_owner();
select public.t_pay((current_setting('t.co1')::jsonb ->> 'orderId')::uuid);
select is(t_cstatus(current_setting('t.c1')::uuid), 'USED', 'a reserved coupon becomes USED when the payment is verified');
select is((select used_order_id::text from public.user_coupons where id = current_setting('t.c1')::uuid),
  current_setting('t.co1')::jsonb ->> 'orderId', 'with its order');
select ok((select used_at is not null from public.user_coupons where id = current_setting('t.c1')::uuid), 'and a use time');
select is((select amount from public.payments where order_id = (current_setting('t.co1')::jsonb ->> 'orderId')::uuid), 9000,
  'the provider is asked for the discounted amount');
select throws_ok(format($$select public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0), %L)$$, current_setting('t.c1')),
  'P0001', 'COUPON_NOT_USABLE', 'a USED coupon cannot be used again');

-- Cap, fixed amount, and the discount never exceeding the total (zero-amount path).
select set_config('t.c2', public.t_coupon('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000f32')::text, true);
select is((public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(2, 1), current_setting('t.c2')::uuid) ->> 'couponDiscount')::int,
  3000, 'FREE_ITEM is capped by the rule (3000 < 5000)');
select set_config('t.c3', public.t_coupon('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000f33')::text, true);
select is((public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0), current_setting('t.c3')::uuid) ->> 'amount')::int,
  1500, 'FIXED_AMOUNT 3000 on 4500 leaves 1500');
select set_config('t.c4', public.t_coupon('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000f34')::text, true);
select set_config('t.zo', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0), current_setting('t.c4')::uuid)::text, true);
select is((current_setting('t.zo')::jsonb ->> 'couponDiscount')::int, 4500, 'the discount never exceeds the menu amount');
select is((select row(menu_amount, coupon_discount, paid_amount, payment_method, status, payment_status)::text from public.orders
  where id = (current_setting('t.zo')::jsonb ->> 'orderId')::uuid), '(4500,4500,0,NONE,PAID,PAID)',
  'a fully covered order is paid at once without a provider');
select is(t_cstatus(current_setting('t.c4')::uuid), 'USED', 'and its coupon is USED');
select is((select amount from public.payments where order_id = (current_setting('t.zo')::jsonb ->> 'orderId')::uuid), 0, 'with a zero payment');

-- Release on failure, customer cancel and expiry.
select set_config('t.c5', public.t_coupon('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000f32')::text, true);
select set_config('t.f1', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0), current_setting('t.c5')::uuid)::text, true);
select is(t_cstatus(current_setting('t.c5')::uuid), 'RESERVED', 'reserved at checkout');
select public.apply_payment_result((current_setting('t.f1')::jsonb ->> 'paymentId')::uuid, 'FAILED', null, null, 'ev-fail-1', 'CONFIRM');
select is(t_cstatus(current_setting('t.c5')::uuid), 'AVAILABLE', 'a failed payment releases the coupon');
select ok((select reserved_order_id is null from public.user_coupons where id = current_setting('t.c5')::uuid), 'and clears the reservation');
select set_config('t.f2', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0), current_setting('t.c5')::uuid)::text, true);
select t_as('00000000-0000-4000-8000-0000000000e1');
select public.customer_cancel_order((current_setting('t.f2')::jsonb ->> 'orderId')::uuid, 'PENDING_PAYMENT');
select t_owner();
select is(t_cstatus(current_setting('t.c5')::uuid), 'AVAILABLE', 'cancelling the unpaid order releases the coupon');
select set_config('t.f3', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0), current_setting('t.c5')::uuid)::text, true);
update public.orders set expires_at = now() - interval '1 second' where id = (current_setting('t.f3')::jsonb ->> 'orderId')::uuid;
select is((select private.expire_order((current_setting('t.f3')::jsonb ->> 'orderId')::uuid)), true, 'the unpaid order expires');
select is(t_cstatus(current_setting('t.c5')::uuid), 'AVAILABLE', 'expiry releases the coupon');
select set_config('t.f4', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0), current_setting('t.c5')::uuid)::text, true);
select is(t_cstatus(current_setting('t.c5')::uuid), 'RESERVED', 'and the released coupon can be reserved again');
select is((select count(*) from public.stamp_transactions where order_id = (current_setting('t.f1')::jsonb ->> 'orderId')::uuid), 0::bigint,
  'releasing writes no stamp ledger rows');

-- Rejections.
select set_config('t.cx', public.t_coupon('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000f33')::text, true);
select t_as('00000000-0000-4000-8000-0000000000e6');
select throws_ok(format($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), %L, 0, 'CARD', null)$$, current_setting('t.cx')),
  'P0001', 'COUPON_NOT_USABLE', 'a coupon owned by another user is rejected');
select throws_ok(format($$select public.quote_checkout(public.t_lines(1, 0), %L)$$, current_setting('t.cx')),
  'P0001', 'COUPON_NOT_USABLE', 'and so is a quote with it');
select t_owner();
update public.user_coupons set expires_at = now() - interval '1 minute' where id = current_setting('t.cx')::uuid;
select t_as('00000000-0000-4000-8000-0000000000e1');
select throws_ok(format($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), %L, 0, 'CARD', null)$$, current_setting('t.cx')),
  'P0001', 'COUPON_EXPIRED', 'an expired coupon is rejected');
select is((select display_status::text from public.user_coupon_view where id = current_setting('t.cx')::uuid), 'EXPIRED',
  'the wallet view shows an ended AVAILABLE coupon as EXPIRED');
select t_owner();
select set_config('t.cd', public.t_coupon('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000f35')::text, true);
select t_as('00000000-0000-4000-8000-0000000000e1');
select throws_ok(format($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), %L, 0, 'CARD', null)$$, current_setting('t.cd')),
  'P0001', 'COUPON_NOT_USABLE', 'a coupon with no eligible line in the cart is rejected');
select ok(not ((public.quote_checkout(public.t_lines(1, 0)) -> 'usableCouponIds') @> to_jsonb(array[current_setting('t.cd')])),
  'and is not listed as usable');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, 100, 'CARD', null)$$,
  'P0001', 'POINTS_EXCEED_BALANCE', 'points beyond the (empty) balance are rejected');
select t_owner();

-- ===== refund reversal (OQ-28, OQ-29) =====
select set_config('t.rc', public.t_coupon('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000f33')::text, true);
select set_config('t.r1', public.t_paid_order('00000000-0000-4000-8000-0000000000e3', public.t_lines(2, 0), current_setting('t.rc')::uuid)::text, true);
select is(t_cstatus(current_setting('t.rc')::uuid), 'USED', 'coupon USED after payment');
select public.t_staff(current_setting('t.r1')::uuid, 'REJECT', 'SOLD_OUT');
select is(t_cstatus(current_setting('t.rc')::uuid), 'USED', 'it stays USED until the refund really succeeded');
select set_config('t.r1refund', (select r.id::text from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = current_setting('t.r1')::uuid), true);
select is((select amount from public.refunds where id = current_setting('t.r1refund')::uuid), 6000, 'the refund is the discounted amount');
select public.record_refund_result(current_setting('t.r1refund')::uuid, true, 'rf-r1', null);
select is(t_cstatus(current_setting('t.rc')::uuid), 'AVAILABLE', 'a successful refund restores the used coupon');
select ok((select used_order_id is null and used_at is null and reserved_order_id is null from public.user_coupons
  where id = current_setting('t.rc')::uuid), 'with the order links cleared');
select ok((select expires_at > now() from public.user_coupons where id = current_setting('t.rc')::uuid), 'and its original expiry');
select public.record_refund_result(current_setting('t.r1refund')::uuid, true, 'rf-r1', null);
select is(t_cstatus(current_setting('t.rc')::uuid), 'AVAILABLE', 'a repeated refund result changes nothing');
select is((select user_coupon_id::text from public.orders where id = current_setting('t.r1')::uuid), current_setting('t.rc'),
  'the refunded order still records which coupon it used');

-- Restore as expired.
select set_config('t.rce', public.t_coupon('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000f33')::text, true);
select set_config('t.r2', public.t_paid_order('00000000-0000-4000-8000-0000000000e3', public.t_lines(2, 0), current_setting('t.rce')::uuid)::text, true);
update public.user_coupons set expires_at = now() - interval '1 hour' where id = current_setting('t.rce')::uuid;
select public.t_staff(current_setting('t.r2')::uuid, 'REJECT', 'TOO_BUSY');
select public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = current_setting('t.r2')::uuid), true, 'rf-r2', null);
select is(t_cstatus(current_setting('t.rce')::uuid), 'EXPIRED', 'OQ-28 a coupon that ended meanwhile is restored as EXPIRED');

-- A fully covered (zero-amount) order has no provider refund: cancelling restores the coupon at once.
select set_config('t.rz', public.t_coupon('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000f34')::text, true);
select set_config('t.r3', public.t_paid_order('00000000-0000-4000-8000-0000000000e3', public.t_lines(1, 0), current_setting('t.rz')::uuid)::text, true);
select t_as('00000000-0000-4000-8000-0000000000e3');
select public.customer_cancel_order(current_setting('t.r3')::uuid, 'PAID');
select t_owner();
select is(t_cstatus(current_setting('t.rz')::uuid), 'AVAILABLE', 'cancelling a zero-amount paid order restores its coupon');
select is((select count(*) from public.refunds r join public.payments p on p.id = r.payment_id where p.order_id = current_setting('t.r3')::uuid),
  0::bigint, 'without a provider refund');

-- Earned stamp reversal.
select set_config('t.s1', public.t_paid_order('00000000-0000-4000-8000-0000000000e3', public.t_lines(1, 0))::text, true);
select t_complete(current_setting('t.s1')::uuid);
select is(t_bal('00000000-0000-4000-8000-0000000000e3'), 1, 'the completed order earned a stamp');
select set_config('t.s1refund', private.request_refund((select id from public.payments where order_id = current_setting('t.s1')::uuid),
  'TEST_REVERSAL', null)::text, true);
select public.record_refund_result(current_setting('t.s1refund')::uuid, true, 'rf-s1', null);
select is(t_bal('00000000-0000-4000-8000-0000000000e3'), 0, 'refunding it takes the earned stamp back');
select is((select row(kind, delta, label)::text from public.stamp_transactions
  where idempotency_key = 'earn_reversal:' || current_setting('t.s1')), '(EARN_REVERSAL,-1,"환불로 적립 취소")', 'with an EARN_REVERSAL row');
select lives_ok($$select private.reverse_order_rewards(current_setting('t.s1')::uuid)$$, 'reversing again is harmless');
select is((select count(*) from public.stamp_transactions where order_id = current_setting('t.s1')::uuid), 2::bigint,
  'exactly one earn and one reversal exist for the order');

-- Shortfall: the earned stamp was already exchanged; nothing is taken back and the gap is logged.
select set_config('t.s2', public.t_paid_order('00000000-0000-4000-8000-0000000000e4', public.t_lines(1, 0))::text, true);
select t_complete(current_setting('t.s2')::uuid);
select private.issue_coupon_for_stamps('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-000000000f37', gen_random_uuid());
select is(t_bal('00000000-0000-4000-8000-0000000000e4'), 0, 'the earned stamp was spent on a coupon');
select set_config('t.s2refund', private.request_refund((select id from public.payments where order_id = current_setting('t.s2')::uuid),
  'TEST_REVERSAL', null)::text, true);
select public.record_refund_result(current_setting('t.s2refund')::uuid, true, 'rf-s2', null);
select is(t_bal('00000000-0000-4000-8000-0000000000e4'), 0, 'OQ-29 the balance never goes negative');
select is((select count(*) from public.stamp_transactions where idempotency_key = 'earn_reversal:' || current_setting('t.s2')), 0::bigint,
  'no reversal row is written when nothing is left to take back');
select is((select after ->> 'shortfall' from public.admin_audit_log
  where entity = 'stamp_reversal_shortfall' and entity_id = current_setting('t.s2')), '1', 'the shortfall is logged in the audit trail');
select is(t_bal('00000000-0000-4000-8000-0000000000e4'), t_sum('00000000-0000-4000-8000-0000000000e4'),
  'balance equals the ledger sum');
select is(t_bal('00000000-0000-4000-8000-0000000000e3'), t_sum('00000000-0000-4000-8000-0000000000e3'),
  'balance equals the ledger sum for the reversal member too');

-- ===== ledger append-only =====
select throws_ok($$update public.stamp_transactions set delta = 99 where user_id = '00000000-0000-4000-8000-0000000000e5'$$,
  'P0001', 'APPEND_ONLY', 'ledger rows cannot be updated, even by the table owner');
select throws_ok($$delete from public.stamp_transactions where user_id = '00000000-0000-4000-8000-0000000000e5'$$,
  'P0001', 'APPEND_ONLY', 'or deleted');
set local role service_role;
select throws_ok($$update public.stamp_transactions set label = 'x' where user_id = '00000000-0000-4000-8000-0000000000e5'$$,
  'P0001', 'APPEND_ONLY', 'not even by the service role');
select throws_ok($$delete from public.stamp_transactions where user_id = '00000000-0000-4000-8000-0000000000e5'$$,
  'P0001', 'APPEND_ONLY', 'the service role cannot delete ledger rows either');
reset role;
select t_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$update public.stamp_transactions set delta = 99$$, '42501', null, 'an admin session has no write grant on the ledger');
select throws_ok($$delete from public.stamp_transactions$$, '42501', null, 'nor a delete grant');
select t_owner();

-- ===== RLS: allowed and denied =====
select t_as('00000000-0000-4000-8000-0000000000e5');
select is((select count(*) from public.stamp_transactions), 3::bigint, 'customer: reads their own ledger rows (earn + two redeems)');
select is((select balance from public.stamp_balances), 2, 'customer: reads their own balance');
select is((select count(*) from public.user_coupons), 2::bigint, 'customer: reads their own coupons');
select is((select count(*) from public.user_coupon_view), 2::bigint, 'customer: reads their own wallet view');
select cmp_ok((select count(*) from public.coupons), '>=', 7::bigint, 'customer: reads the active exchange rules');
select is((select count(*) from public.coupons where not is_active), 0::bigint, 'customer: never sees an inactive rule');
select is((select count(*) from public.stamp_policies where id = (current_setting('t.pol2')::jsonb ->> 'id')::uuid), 1::bigint,
  'customer: reads the stamp policy');
select throws_ok($$insert into public.stamp_transactions (user_id, kind, delta, balance_after, label, idempotency_key)
  values ('00000000-0000-4000-8000-0000000000e5', 'EARN', 5, 5, 'cheat', 'cheat:1')$$, '42501', null, 'customer: cannot write the ledger');
select throws_ok($$update public.user_coupons set status = 'AVAILABLE'$$, '42501', null, 'customer: cannot change a coupon');
select throws_ok($$update public.stamp_balances set balance = 999$$, '42501', null, 'customer: cannot change a balance');
select throws_ok($$insert into public.coupons (title, required_stamps, valid_days, benefit_type, discount_amount)
  values ('free', 1, 1, 'FIXED_AMOUNT', 1000)$$, '42501', null, 'customer: cannot create an exchange rule');
select is(public.t_coupon_updates(), 0::bigint,
  'customer: cannot edit an exchange rule (no row is updatable)');
select throws_ok($$select public.admin_stamp_overview()$$, 'P0001', 'FORBIDDEN', 'customer: no stamp overview');
select t_owner();

-- Another customer sees nothing of e5.
select t_as('00000000-0000-4000-8000-0000000000e6');
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-0000000000e5'), 0::bigint,
  'other customer: cannot read someone else''s ledger');
select is((select count(*) from public.stamp_balances where user_id = '00000000-0000-4000-8000-0000000000e5'), 0::bigint,
  'other customer: cannot read someone else''s balance');
select is((select count(*) from public.user_coupons where user_id = '00000000-0000-4000-8000-0000000000e5'), 0::bigint,
  'other customer: cannot read someone else''s coupons');
select is((select count(*) from public.user_coupon_view where user_id = '00000000-0000-4000-8000-0000000000e5'), 0::bigint,
  'other customer: cannot read someone else''s wallet view');
select t_owner();

-- Staff.
select t_as('00000000-0000-4000-8000-0000000000b1');
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-0000000000e5'), 0::bigint,
  'staff: cannot read member ledgers');
select is((select count(*) from public.user_coupons where user_id = '00000000-0000-4000-8000-0000000000e5'), 0::bigint,
  'staff: cannot read member coupons');
select is((select count(*) from public.stamp_balances where user_id = '00000000-0000-4000-8000-0000000000e5'), 0::bigint,
  'staff: cannot read member balances');
select cmp_ok((select count(*) from public.coupons), '>=', 7::bigint, 'staff: reads the active exchange rules');
select is(public.t_coupon_updates(), 0::bigint,
  'staff: cannot edit an exchange rule (no row is updatable)');
select throws_ok($$select public.admin_stamp_overview()$$, 'P0001', 'FORBIDDEN', 'staff: no stamp overview');
select is((select count(*) from public.orders where id = (current_setting('t.co1')::jsonb ->> 'orderId')::uuid), 1::bigint,
  'staff: still reads a paid order');
select is((select coupon_title_snapshot from public.orders where id = (current_setting('t.co1')::jsonb ->> 'orderId')::uuid),
  'T 아메리카노 또는 라떼', 'staff: sees the coupon title on the order without touching the wallet');
select t_owner();

-- Admin.
select t_as('00000000-0000-4000-8000-0000000000a1');
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-0000000000e5'), 3::bigint,
  'admin: reads any member ledger');
select is((select balance from public.stamp_balances where user_id = '00000000-0000-4000-8000-0000000000e5'), 2,
  'admin: reads any member balance');
select is((select count(*) from public.user_coupons where user_id = '00000000-0000-4000-8000-0000000000e5'), 2::bigint,
  'admin: reads any member coupons');
select is((select count(*) from public.coupons where id = '00000000-0000-4000-8000-000000000f36'), 1::bigint,
  'admin: sees inactive rules too');
select lives_ok($$insert into public.coupons (id, title, required_stamps, valid_days, benefit_type, discount_amount)
  values ('00000000-0000-4000-8000-000000000f40', 'T 관리자 규칙', 4, 60, 'FIXED_AMOUNT', 2000)$$, 'admin: creates an exchange rule');
select lives_ok($$update public.coupons set title = 'T 관리자 규칙 수정', is_active = false where id = '00000000-0000-4000-8000-000000000f40'$$,
  'admin: edits and deactivates a rule');
select throws_ok($$delete from public.coupons where id = '00000000-0000-4000-8000-000000000f40'$$, '42501', null,
  'admin: cannot delete a rule (deactivate instead)');
select throws_ok($$insert into public.coupons (title, required_stamps, valid_days, benefit_type) values ('x', 1, 1, 'FIXED_AMOUNT')$$,
  '23514', null, 'a fixed-amount rule needs an amount');
select throws_ok($$insert into public.coupons (title, required_stamps, valid_days, benefit_type) values ('x', 100, 1, 'FREE_ITEM')$$,
  '23514', null, 'a rule cannot cost more than 99 stamps');
select throws_ok($$update public.user_coupons set status = 'AVAILABLE'$$, '42501', null, 'admin: cannot rewrite issued coupons directly');
select is((select (public.admin_stamp_overview() ->> 'outstandingStamps')::int >= 2), true, 'admin: the stamp overview works');
select ok((select count(*) from public.admin_audit_log where entity = 'coupons'
  and entity_id = '00000000-0000-4000-8000-000000000f40') = 2, 'rule changes are audited (insert and update)');
select t_owner();

-- Anonymous.
select t_anon();
select throws_ok($$select * from public.stamp_transactions$$, '42501', null, 'anon: no ledger');
select throws_ok($$select * from public.stamp_balances$$, '42501', null, 'anon: no balances');
select throws_ok($$select * from public.user_coupons$$, '42501', null, 'anon: no coupons');
select throws_ok($$select * from public.user_coupon_view$$, '42501', null, 'anon: no wallet view');
select throws_ok($$select * from public.coupons$$, '42501', null, 'anon: no exchange rules');
select throws_ok($$select * from public.stamp_policies$$, '42501', null, 'anon: no policy');
select throws_ok($$select public.redeem_stamps_for_coupon('00000000-0000-4000-8000-000000000f38', gen_random_uuid())$$, '42501', null,
  'anon: cannot exchange');
select throws_ok($$select public.quote_checkout('[]'::jsonb)$$, '42501', null, 'anon: cannot quote');
select throws_ok($$select public.admin_stamp_overview()$$, '42501', null, 'anon: no overview');
select t_owner();

-- Internal functions are not callable from a client session.
select t_as('00000000-0000-4000-8000-0000000000e5');
select throws_ok($$select private.add_stamp_tx('00000000-0000-4000-8000-0000000000e5', 'EARN', 5, 'x', 'cheat:2')$$, '42501', null,
  'customer: cannot call the ledger writer');
select throws_ok($$select private.issue_coupon_for_stamps('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-000000000f37', gen_random_uuid())$$,
  '42501', null, 'customer: cannot call the internal exchange');
select t_owner();

-- ===== realtime hint =====
select cmp_ok((select count(*) from realtime.messages where topic = 'user:00000000-0000-4000-8000-0000000000e5'
  and event = 'reward_updated' and payload ->> 'asset' = 'STAMP'), '>=', 1::bigint, 'a stamp change sends reward_updated {asset: STAMP} to the member');
select cmp_ok((select count(*) from realtime.messages where topic = 'user:00000000-0000-4000-8000-0000000000e5'
  and event = 'reward_updated' and payload ->> 'asset' = 'COUPON'), '>=', 1::bigint, 'a coupon change sends reward_updated {asset: COUPON}');
select is((select array(select k from jsonb_object_keys(payload - 'id') k order by k) from realtime.messages
  where topic = 'user:00000000-0000-4000-8000-0000000000e5' and event = 'reward_updated' limit 1), array['asset'],
  'the hint carries only the asset kind');
select set_config('realtime.topic', 'user:00000000-0000-4000-8000-0000000000e6', true);
select t_as('00000000-0000-4000-8000-0000000000e5');
select set_config('realtime.topic', 'user:00000000-0000-4000-8000-0000000000e6', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint, 'another member''s topic stays closed');
select t_owner();

select * from finish();
rollback;
