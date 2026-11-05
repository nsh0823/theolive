-- Phase (e) Coupon Points (plan sections 1.9, 3.1, 3.2, 5.3, 5.4, 11.1, 11.4).
-- Requirements: RW-05 (register a code), RW-06 (balance and history), RW-07 (cannot exceed the balance), RW-08 (code
-- rules), PAY-03 (points at checkout), SA-08 (code issue, list, void).
-- Everything runs with members created here (ids f1..f8) and codes created here, and every assertion looks only at
-- their rows, so rows committed by other suites (API integration runs, the seed) never change the result.
-- Truly concurrent cases (two members registering one code, parallel checkouts) need two sessions; they are in
-- packages/api/src/points.integration.test.ts.
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

-- Members: f1 registration, f2 outsider / second registrant, f3 and f4 brute force, f5 checkout and holds,
-- f6 refund restore, f7 expiry, f8 deleted account.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('00000000-0000-4000-8000-0000000000f' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'point' || n || '@example.test', '{}'
  from generate_series(1, 8) n;

insert into public.coupon_point_code_batches (id, amount, quantity, expires_at, memo)
values ('00000000-0000-4000-8000-000000000f51', 5000, 1, now() + interval '400 days', 'pgTAP');

-- A code with a given value; returns its id.
create function public.t_code(p_code text, p_amount int, p_expires interval default interval '90 days') returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.coupon_point_codes (batch_id, code, amount, expires_at)
  values ('00000000-0000-4000-8000-000000000f51', p_code, p_amount, now() + p_expires) returning id into v_id;
  return v_id;
end $$;

-- Gives a member points the way the app does: an unregistered code, registered through the real function.
create function public.t_grant(p_uid text, p_amount int, p_expires interval default interval '90 days') returns uuid language plpgsql as $$
declare v_id uuid;
begin
  v_id := public.t_code('OLIVE-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)),
                        p_amount, p_expires);
  perform private.register_point_code(p_uid::uuid, (select code from public.coupon_point_codes where id = v_id));
  return v_id;
end $$;

create function public.t_lines(p_americano int, p_latte int) returns jsonb language sql as $$
  select coalesce(jsonb_agg(l), '[]'::jsonb) from (
    select jsonb_build_object('menuItemId', '00000000-0000-4000-8000-000000000201', 'temperature', 'HOT', 'quantity', p_americano) l
      where p_americano > 0
    union all
    select jsonb_build_object('menuItemId', '00000000-0000-4000-8000-000000000203', 'temperature', 'ICE', 'quantity', p_latte)
      where p_latte > 0) x;
$$;

create function public.t_order(p_uid text, p_lines jsonb, p_points int, p_coupon uuid default null) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as(p_uid);
  r := public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', p_lines, p_coupon, p_points, 'CARD', null);
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

create function public.t_coupon(p_uid text, p_def uuid) returns uuid language plpgsql as $$
begin
  perform private.add_stamp_tx(p_uid::uuid, 'EARN',
    (select required_stamps from public.coupons where id = p_def), 'test credit', 'tg:' || gen_random_uuid());
  return (private.issue_coupon_for_stamps(p_uid::uuid, p_def, gen_random_uuid()) ->> 'userCouponId')::uuid;
end $$;

create function public.t_bal(p_uid text) returns integer language sql as $$
  select coalesce((select balance from public.coupon_point_balances where user_id = p_uid::uuid), 0);
$$;
create function public.t_sum(p_uid text) returns integer language sql as $$
  select coalesce((select sum(delta) from public.coupon_point_transactions where user_id = p_uid::uuid), 0)::integer;
$$;
create function public.t_avail(p_uid text) returns integer language sql as $$
  select private.usable_points(p_uid::uuid) - private.held_points(p_uid::uuid);
$$;
create function public.t_hold(p_order uuid) returns text language sql as $$
  select status::text from public.coupon_point_holds where order_id = p_order;
$$;
create function public.t_oid(p_order jsonb) returns uuid language sql as $$ select (p_order ->> 'orderId')::uuid $$;

-- Rows an UPDATE of the policy reaches for the current role (row-level security hides the rest).
create function public.t_policy_updates() returns bigint language plpgsql as $$
declare n bigint;
begin
  update public.coupon_point_policy set min_use_amount = 0;
  get diagnostics n = row_count;
  return n;
end $$;

select plan(225);

update public.store_settings set is_open = true, is_accepting_orders = true, pending_payment_ttl_minutes = 15;
update public.coupon_point_policy set min_use_amount = 0, use_unit = 1, max_use_per_order = null;
insert into public.coupons (id, title, required_stamps, valid_days, benefit_type, discount_amount)
values ('00000000-0000-4000-8000-000000000f63', 'T 정액 3000', 2, 30, 'FIXED_AMOUNT', 3000);

-- ===== policy defaults (OQ-30, OQ-32) =====
select is((select row(min_use_amount, use_unit, max_use_per_order, registration_attempt_limit, registration_attempt_window_minutes)::text
  from public.coupon_point_policy where id = 1), '(0,1,,5,10)', 'OQ-30/32 no minimum, 1-won unit, no cap, 5 failures per 10 minutes');
select throws_ok($$insert into public.coupon_point_policy (id) values (2)$$, '23514', null, 'the policy is a single row');

-- ===== registering a code (RW-05, RW-08) =====
select public.t_code('OLIVE-TST1-AAA1', 5000);
select public.t_code('OLIVE-TST1-AAA2', 3000);
select public.t_code('OLIVE-TST1-AAA3', 3000, interval '-1 day');
select public.t_code('OLIVE-TST1-AAA4', 3000);
update public.coupon_point_codes set status = 'VOID', voided_at = now() where code = 'OLIVE-TST1-AAA4';
select public.t_code('OLIVE-TST1-AAA5', 2000);

select t_as('00000000-0000-4000-8000-0000000000f1');
select is(public.register_coupon_point_code('hello') ->> 'errorCode', 'CODE_INVALID', 'RW-08 a malformed code is invalid');
select is(public.register_coupon_point_code('OLIVE-ZZZZ-ZZZZ') ->> 'errorCode', 'CODE_INVALID', 'an unknown code is invalid');
select is(public.register_coupon_point_code(null) ->> 'errorCode', 'CODE_INVALID', 'a missing code is invalid');
select is(public.register_coupon_point_code('OLIVE-TST1-AAA3') ->> 'errorCode', 'CODE_EXPIRED', 'an expired code is rejected');
select is(public.register_coupon_point_code('OLIVE-TST1-AAA1') ->> 'status', 'REGISTERED', 'a valid code registers');
select t_owner();
select is(t_bal('00000000-0000-4000-8000-0000000000f1'), 5000, 'RW-06 the balance is the code amount');
select is((select row(kind, delta, balance_after, label)::text from public.coupon_point_transactions
  where user_id = '00000000-0000-4000-8000-0000000000f1'), '(REGISTER,5000,5000,"코드 등록")', 'the ledger has one REGISTER row');
select is((select row(status, registered_by)::text from public.coupon_point_codes where code = 'OLIVE-TST1-AAA1'),
  '(REGISTERED,00000000-0000-4000-8000-0000000000f1)', 'the code is marked registered by the member');
select ok((select lot_expires_at = (select expires_at from public.coupon_point_codes where code = 'OLIVE-TST1-AAA1')
  from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-0000000000f1'),
  'the row remembers when its points end');
select t_as('00000000-0000-4000-8000-0000000000f1');
select is(public.register_coupon_point_code('olive-tst1-aaa2 ') ->> 'status', 'REGISTERED', 'lower case and spaces are normalized');
select is(public.register_coupon_point_code('OLIVE-TST1-AAA1') ->> 'errorCode', 'CODE_ALREADY_REGISTERED', 'registering your own code again is rejected');
select t_as('00000000-0000-4000-8000-0000000000f2');
select is(public.register_coupon_point_code('OLIVE-TST1-AAA1') ->> 'errorCode', 'CODE_ALREADY_REGISTERED', 'another member cannot register it either');
select is(public.register_coupon_point_code('OLIVE-TST1-AAA4') ->> 'errorCode', 'CODE_VOID', 'a voided code is rejected');
select is(public.register_coupon_point_code('OLIVEtst1aaa5') ->> 'status', 'REGISTERED', 'a code typed without dashes is accepted');
select t_owner();
select is(t_bal('00000000-0000-4000-8000-0000000000f1'), 8000, 'only the two successful codes were added');
select is(t_bal('00000000-0000-4000-8000-0000000000f2'), 2000, 'the second member got only their own code');
select is((select count(*) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-0000000000f1'), 2::bigint,
  'failed attempts never reach the ledger');
select is((select count(*) from public.coupon_point_code_attempts where user_id = '00000000-0000-4000-8000-0000000000f1' and not succeeded),
  5::bigint, 'every failed entry is logged (invalid x3, expired, repeat)');
select is((select count(*) from public.coupon_point_code_attempts where user_id = '00000000-0000-4000-8000-0000000000f1' and succeeded),
  2::bigint, 'and so is every success');
select is(public.t_sum('00000000-0000-4000-8000-0000000000f1'), t_bal('00000000-0000-4000-8000-0000000000f1'), 'balance equals the ledger sum');

-- ===== brute-force limit (OQ-32) =====
select public.t_code('OLIVE-TST2-BBB1', 1000);
select t_as('00000000-0000-4000-8000-0000000000f3');
select is((select count(*) from (select public.register_coupon_point_code('OLIVE-NOPE-000' || n) ->> 'errorCode' e
  from generate_series(1, 5) n) x where e = 'CODE_INVALID'), 5::bigint, 'five wrong codes are answered as invalid');
select is(public.register_coupon_point_code('OLIVE-TST2-BBB1') ->> 'errorCode', 'TOO_MANY_ATTEMPTS', 'the sixth entry is blocked even with a valid code');
select ok((public.register_coupon_point_code('OLIVE-TST2-BBB1') ->> 'retryAfterSeconds')::int between 1 and 600, 'with a wait time of at most 10 minutes');
select t_owner();
select is((select status::text from public.coupon_point_codes where code = 'OLIVE-TST2-BBB1'), 'UNUSED', 'the blocked code stays unused');
select is((select count(*) from public.coupon_point_code_attempts where user_id = '00000000-0000-4000-8000-0000000000f3'), 5::bigint,
  'blocked calls are not logged, so the wait does not grow');
select t_as('00000000-0000-4000-8000-0000000000f4');
select is(public.register_coupon_point_code('OLIVE-TST2-BBB1') ->> 'status', 'REGISTERED', 'the limit is per account: another member can register');
select t_owner();
update public.coupon_point_code_attempts set created_at = now() - interval '11 minutes'
 where user_id = '00000000-0000-4000-8000-0000000000f3';
select public.t_code('OLIVE-TST2-BBB2', 1000);
select t_as('00000000-0000-4000-8000-0000000000f3');
select is(public.register_coupon_point_code('OLIVE-TST2-BBB2') ->> 'status', 'REGISTERED', 'after the window passes the member can register again');
select t_owner();
-- The limit and window come from the policy row.
update public.coupon_point_policy set registration_attempt_limit = 2;
select t_as('00000000-0000-4000-8000-0000000000f2');
select public.register_coupon_point_code('OLIVE-NOPE-0001');
select public.register_coupon_point_code('OLIVE-NOPE-0002');
select is(public.register_coupon_point_code('OLIVE-NOPE-0003') ->> 'errorCode', 'TOO_MANY_ATTEMPTS', 'a lower policy limit applies at once');
select t_owner();
update public.coupon_point_policy set registration_attempt_limit = 5;

-- ===== who may register =====
select t_anon();
select throws_ok($$select public.register_coupon_point_code('OLIVE-TST1-AAA1')$$, '42501', null, 'anon cannot register');
select throws_ok($$select public.get_my_point_summary()$$, '42501', null, 'anon has no summary');
select t_owner();
update public.profiles set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000f8';
select t_as('00000000-0000-4000-8000-0000000000f8');
select throws_ok($$select public.register_coupon_point_code('OLIVE-TST1-AAA1')$$, 'P0001', 'FORBIDDEN', 'a deleted account cannot register');
select t_owner();

-- ===== ledger rules =====
select throws_ok($$update public.coupon_point_transactions set label = 'x'$$, 'P0001', 'APPEND_ONLY', 'the ledger cannot be updated (owner)');
select throws_ok($$delete from public.coupon_point_transactions$$, 'P0001', 'APPEND_ONLY', 'the ledger cannot be deleted (owner)');
select t_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$update public.coupon_point_transactions set label = 'x'$$, '42501', null, 'the ledger cannot be updated (admin)');
select throws_ok($$delete from public.coupon_point_transactions$$, '42501', null, 'the ledger cannot be deleted (admin)');
select t_owner();
select throws_ok($$select private.add_point_tx('00000000-0000-4000-8000-0000000000f1', 'USE', -9000, 'x', 'ledger:over',
  (select id from public.coupon_point_codes where code = 'OLIVE-TST1-AAA1'))$$, 'P0001', 'POINTS_EXCEED_BALANCE',
  'a ledger row cannot take more than the lot has');
select throws_ok($$select private.add_point_tx('00000000-0000-4000-8000-0000000000f1', 'USE', 100, 'x', 'ledger:sign',
  (select id from public.coupon_point_codes where code = 'OLIVE-TST1-AAA1'))$$, '23514', null, 'a USE row must be negative');
select is(private.add_point_tx('00000000-0000-4000-8000-0000000000f1', 'USE', -100, 'x', 'ledger:dup',
  (select id from public.coupon_point_codes where code = 'OLIVE-TST1-AAA1')) is not null, true, 'a ledger row is written');
select is(private.add_point_tx('00000000-0000-4000-8000-0000000000f1', 'USE', -100, 'x', 'ledger:dup',
  (select id from public.coupon_point_codes where code = 'OLIVE-TST1-AAA1')), null::bigint, 'the same key again is a no-op');
select is(t_bal('00000000-0000-4000-8000-0000000000f1'), 7900, 'and moves the balance only once');
select is(t_sum('00000000-0000-4000-8000-0000000000f1'), 7900, 'balance equals the ledger sum');

-- ===== quote (PAY-03): the server decides =====
-- f5: 10,000 (ends in 90 days) and 2,000 (ends in 30 days).
select public.t_grant('00000000-0000-4000-8000-0000000000f5', 10000, interval '90 days');
select public.t_grant('00000000-0000-4000-8000-0000000000f5', 2000, interval '30 days');
select t_as('00000000-0000-4000-8000-0000000000f5');
select is((public.quote_checkout(public.t_lines(1, 0), null, 0) ->> 'pointsUsed')::int, 0, 'no points requested, none used');
select is(public.quote_checkout(public.t_lines(1, 0), null, 3000) ->> 'paidAmount', '1500', 'a quote applies the points and shows the rest');
select is(public.quote_checkout(public.t_lines(1, 0), null, 99999) ->> 'pointsUsed', '4500', 'more than the total is clamped to the payable amount');
select is(public.quote_checkout(public.t_lines(1, 0), null, 99999) ->> 'paidAmount', '0', 'so the total floors at 0');
select is(public.quote_checkout(public.t_lines(1, 0), null, 0) ->> 'pointsAvailable', '12000', 'the quote reports the spendable balance');
select is(public.quote_checkout(public.t_lines(1, 0), null, 0) ->> 'maxPointsUsable', '4500', 'and what "use all" would apply');
select is(public.quote_checkout(public.t_lines(3, 0), null, 99999) ->> 'pointsUsed', '12000', 'a large cart is clamped to the balance');
select throws_ok($$select public.quote_checkout(public.t_lines(1, 0), null, -5)$$, 'P0001', 'INVALID_INPUT', 'a negative amount is invalid');
select t_owner();
select is((select count(*) from public.coupon_point_holds where user_id = '00000000-0000-4000-8000-0000000000f5'), 0::bigint, 'a quote holds nothing');

-- ===== strict checkout rules =====
select t_as('00000000-0000-4000-8000-0000000000f5');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, 4501, 'CARD', null)$$,
  'P0001', 'POINTS_EXCEED_PAYABLE', 'points cannot exceed the payable amount');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(3, 0), null, 12001, 'CARD', null)$$,
  'P0001', 'POINTS_EXCEED_BALANCE', 'RW-07 points cannot exceed the balance');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, -1, 'CARD', null)$$,
  'P0001', 'INVALID_INPUT', 'negative points are invalid');
select t_owner();
update public.coupon_point_policy set min_use_amount = 1000;
select t_as('00000000-0000-4000-8000-0000000000f5');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, 500, 'CARD', null)$$,
  'P0001', 'POINTS_BELOW_MINIMUM', 'a policy minimum is enforced');
select is(public.quote_checkout(public.t_lines(1, 0), null, 500) ->> 'pointsUsed', '0', 'and a quote below it applies nothing');
select t_owner();
update public.coupon_point_policy set min_use_amount = 0, use_unit = 100;
select t_as('00000000-0000-4000-8000-0000000000f5');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, 150, 'CARD', null)$$,
  'P0001', 'INVALID_INPUT', 'a policy unit is enforced');
select is(public.quote_checkout(public.t_lines(1, 0), null, 99999) ->> 'pointsUsed', '4500', 'a quote rounds down to the unit');
select t_owner();
update public.coupon_point_policy set use_unit = 1, max_use_per_order = 2000;
select t_as('00000000-0000-4000-8000-0000000000f5');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, 3000, 'CARD', null)$$,
  'P0001', 'POINTS_EXCEED_PAYABLE', 'a policy cap is enforced');
select is(public.quote_checkout(public.t_lines(1, 0), null, 3000) ->> 'pointsUsed', '2000', 'and a quote is clamped to it');
select t_owner();
update public.coupon_point_policy set max_use_per_order = null;
select is((select count(*) from public.orders where customer_id = '00000000-0000-4000-8000-0000000000f5'), 0::bigint, 'no rejected checkout left an order');

-- ===== hold at checkout, capture at payment =====
select set_config('t.h1', public.t_order('00000000-0000-4000-8000-0000000000f5', public.t_lines(1, 0), 3000)::text, true);
select is((current_setting('t.h1')::jsonb ->> 'amount')::int, 1500, 'the payment amount is the total minus the points');
select is((select points_used from public.orders where id = t_oid(current_setting('t.h1')::jsonb)), 3000, 'the order snapshots the points used');
select is(t_hold(t_oid(current_setting('t.h1')::jsonb)), 'HELD', 'the points are held');
select is(t_bal('00000000-0000-4000-8000-0000000000f5'), 12000, 'a hold does not touch the ledger or balance');
select is((select count(*) from public.coupon_point_transactions where order_id = t_oid(current_setting('t.h1')::jsonb)), 0::bigint, 'no USE rows before payment');
select is(t_avail('00000000-0000-4000-8000-0000000000f5'), 9000, 'but the held points are no longer available');
select t_as('00000000-0000-4000-8000-0000000000f5');
select is(public.get_my_point_summary() ->> 'available', '9000', 'the summary shows the available points');
select is(public.get_my_point_summary() ->> 'balance', '12000', 'and the balance');
select is(public.get_my_point_summary() ->> 'held', '3000', 'and what is held');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(3, 0), null, 9001, 'CARD', null)$$,
  'P0001', 'POINTS_EXCEED_BALANCE', 'PAY-03 a second checkout cannot use held points');
select t_owner();
select set_config('t.h2', public.t_order('00000000-0000-4000-8000-0000000000f5', public.t_lines(3, 0), 9000)::text, true);
select is(t_avail('00000000-0000-4000-8000-0000000000f5'), 0, 'two open checkouts hold the whole balance');
select t_as('00000000-0000-4000-8000-0000000000f5');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, 1, 'CARD', null)$$,
  'P0001', 'POINTS_EXCEED_BALANCE', 'RW-07 a third checkout cannot overdraw (no overdraft, ever)');
select t_owner();

-- Replay of a checkout does not hold twice.
select set_config('t.rq', gen_random_uuid()::text, true);
select public.t_as('00000000-0000-4000-8000-0000000000f6');
select t_owner();
select public.t_grant('00000000-0000-4000-8000-0000000000f6', 5000);
select t_as('00000000-0000-4000-8000-0000000000f6');
select set_config('t.rp1', public.create_checkout_order(current_setting('t.rq')::uuid, 'TAKEOUT', public.t_lines(1, 0), null, 2000, 'CARD', null)::text, true);
select set_config('t.rp2', public.create_checkout_order(current_setting('t.rq')::uuid, 'TAKEOUT', public.t_lines(1, 0), null, 2000, 'CARD', null)::text, true);
select t_owner();
select is(current_setting('t.rp2')::jsonb ->> 'isReplay', 'true', 'the same request key is a replay');
select is((select count(*) from public.coupon_point_holds where user_id = '00000000-0000-4000-8000-0000000000f6'), 1::bigint, 'and holds once');
select t_as('00000000-0000-4000-8000-0000000000f6');
select throws_ok(format($$select public.create_checkout_order(%L, 'TAKEOUT', public.t_lines(1, 0), null, 1000, 'CARD', null)$$, current_setting('t.rq')),
  'P0001', 'IDEMPOTENCY_CONFLICT', 'the same key with other points is a conflict');
select t_owner();

-- Capture.
select public.t_pay(t_oid(current_setting('t.h1')::jsonb));
select is(t_hold(t_oid(current_setting('t.h1')::jsonb)), 'CAPTURED', 'payment captures the hold');
select is((select array_agg(delta order by id) from public.coupon_point_transactions where order_id = t_oid(current_setting('t.h1')::jsonb)),
  array[-2000, -1000], 'the earliest-ending lot is spent first, one row per lot');
select is((select array_agg(c.amount order by t.id) from public.coupon_point_transactions t
  join public.coupon_point_codes c on c.id = t.code_id where t.order_id = t_oid(current_setting('t.h1')::jsonb)),
  array[2000, 10000], 'the rows belong to the 2,000 lot and then the 10,000 lot');
select is(t_bal('00000000-0000-4000-8000-0000000000f5'), 9000, 'the balance dropped by the points used');
select is(t_sum('00000000-0000-4000-8000-0000000000f5'), 9000, 'and equals the ledger sum');
select public.t_pay(t_oid(current_setting('t.h1')::jsonb));
select private.capture_point_hold(t_oid(current_setting('t.h1')::jsonb));
select is((select count(*) from public.coupon_point_transactions where order_id = t_oid(current_setting('t.h1')::jsonb)), 2::bigint,
  'a repeated payment result or capture writes nothing more');
select is((select kind::text || ':' || label from public.coupon_point_transactions where order_id = t_oid(current_setting('t.h1')::jsonb) limit 1),
  'USE:주문 결제', 'the history row is a USE linked to the order');

-- ===== release on failure, cancel, expiry, amount mismatch =====
select public.apply_payment_result((current_setting('t.h2')::jsonb ->> 'paymentId')::uuid, 'FAILED', null, null, 'ev-pfail', 'CONFIRM');
select is(t_hold(t_oid(current_setting('t.h2')::jsonb)), 'RELEASED', 'a failed payment releases the hold');
select is((select count(*) from public.coupon_point_transactions where order_id = t_oid(current_setting('t.h2')::jsonb)), 0::bigint, 'and writes no ledger rows');
select is(t_avail('00000000-0000-4000-8000-0000000000f5'), 9000, 'the points are available again');
select ok((select resolved_at is not null from public.coupon_point_holds where order_id = t_oid(current_setting('t.h2')::jsonb)), 'the hold records when it ended');

select set_config('t.h3', public.t_order('00000000-0000-4000-8000-0000000000f5', public.t_lines(1, 0), 2000)::text, true);
select t_as('00000000-0000-4000-8000-0000000000f5');
select public.customer_cancel_order(t_oid(current_setting('t.h3')::jsonb), 'PENDING_PAYMENT');
select t_owner();
select is(t_hold(t_oid(current_setting('t.h3')::jsonb)), 'RELEASED', 'cancelling the unpaid order releases the hold');

select set_config('t.h4', public.t_order('00000000-0000-4000-8000-0000000000f5', public.t_lines(1, 0), 2000)::text, true);
update public.orders set expires_at = now() - interval '1 second' where id = t_oid(current_setting('t.h4')::jsonb);
select is(private.expire_order(t_oid(current_setting('t.h4')::jsonb)), true, 'the unpaid order expires');
select is(t_hold(t_oid(current_setting('t.h4')::jsonb)), 'RELEASED', 'expiry releases the hold');

select set_config('t.h5', public.t_order('00000000-0000-4000-8000-0000000000f5', public.t_lines(1, 0), 2000)::text, true);
select public.apply_payment_result((current_setting('t.h5')::jsonb ->> 'paymentId')::uuid, 'APPROVED', 'pm-mismatch', 1, 'ev-mm', 'CONFIRM');
select is(t_hold(t_oid(current_setting('t.h5')::jsonb)), 'RELEASED', 'an amount mismatch cancels the order and releases the hold');
select is(t_bal('00000000-0000-4000-8000-0000000000f5'), 9000, 'none of these changed the balance');
select is(t_sum('00000000-0000-4000-8000-0000000000f5'), t_bal('00000000-0000-4000-8000-0000000000f5'), 'balance equals the ledger sum');

-- A stale unpaid order's hold is released by the member's next checkout.
select set_config('t.h6', public.t_order('00000000-0000-4000-8000-0000000000f5', public.t_lines(3, 0), 9000)::text, true);
update public.orders set expires_at = now() - interval '1 second' where id = t_oid(current_setting('t.h6')::jsonb);
select set_config('t.h7', public.t_order('00000000-0000-4000-8000-0000000000f5', public.t_lines(3, 0), 9000)::text, true);
select is(t_hold(t_oid(current_setting('t.h6')::jsonb)), 'RELEASED', 'a new checkout first expires the stale order and frees its hold');
select is(t_hold(t_oid(current_setting('t.h7')::jsonb)), 'HELD', 'and holds its own points');
select public.apply_payment_result((current_setting('t.h7')::jsonb ->> 'paymentId')::uuid, 'CANCELLED', null, null, 'ev-h7', 'CONFIRM');

-- ===== coupon and points together; a total of 0 =====
select set_config('t.cp', public.t_coupon('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-000000000f63')::text, true);
select t_as('00000000-0000-4000-8000-0000000000f5');
select is(public.quote_checkout(public.t_lines(2, 0), current_setting('t.cp')::uuid, 8000) ->> 'couponDiscount', '3000', 'the coupon discount comes first');
select is(public.quote_checkout(public.t_lines(2, 0), current_setting('t.cp')::uuid, 8000) ->> 'pointsUsed', '6000', 'points apply only to what the coupon left');
select is(public.quote_checkout(public.t_lines(2, 0), current_setting('t.cp')::uuid, 8000) ->> 'paidAmount', '0', 'so the total is floored at 0');
select throws_ok(format($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(2, 0), %L, 6001, 'CARD', null)$$, current_setting('t.cp')),
  'P0001', 'POINTS_EXCEED_PAYABLE', 'checkout rejects more points than the total after the coupon');
select t_owner();
select set_config('t.z1', public.t_order('00000000-0000-4000-8000-0000000000f5', public.t_lines(2, 0), 6000, current_setting('t.cp')::uuid)::text, true);
select is((select row(status, payment_status, menu_amount, coupon_discount, points_used, paid_amount)::text from public.orders where id = t_oid(current_setting('t.z1')::jsonb)),
  '(PAID,PAID,9000,3000,6000,0)', 'PAY-03 a fully covered order is paid at once');
select is((select row(method, amount)::text from public.payments where order_id = t_oid(current_setting('t.z1')::jsonb)), '(NONE,0)', 'with no provider payment');
select is(t_hold(t_oid(current_setting('t.z1')::jsonb)), 'CAPTURED', 'its hold is captured');
select is((select status::text from public.user_coupons where id = current_setting('t.cp')::uuid), 'USED', 'and the coupon is used');
select is(t_bal('00000000-0000-4000-8000-0000000000f5'), 3000, 'the points were deducted');
select is((select count(*) from public.stamp_transactions where order_id = t_oid(current_setting('t.z1')::jsonb)), 0::bigint, 'points never touch the stamp ledger');

-- ===== refund restore (OQ-30) =====
-- f6 has one 5,000 lot, 2,000 of it held by t.rp1 (released below); give a second lot ending earlier.
select public.apply_payment_result((current_setting('t.rp1')::jsonb ->> 'paymentId')::uuid, 'FAILED', null, null, 'ev-rp1', 'CONFIRM');
select public.t_grant('00000000-0000-4000-8000-0000000000f6', 1000, interval '20 days');
select set_config('t.rf', public.t_order('00000000-0000-4000-8000-0000000000f6', public.t_lines(1, 0), 3000)::text, true);
select public.t_pay(t_oid(current_setting('t.rf')::jsonb));
select is((select array_agg(delta order by id) from public.coupon_point_transactions where order_id = t_oid(current_setting('t.rf')::jsonb)),
  array[-1000, -2000], 'the order used both lots, the earlier-ending one first');
select is(t_bal('00000000-0000-4000-8000-0000000000f6'), 3000, 'balance after use');
select public.t_staff(t_oid(current_setting('t.rf')::jsonb), 'REJECT', 'SOLD_OUT');
select is(t_bal('00000000-0000-4000-8000-0000000000f6'), 3000, 'the points stay spent until the refund really succeeded');
select public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = t_oid(current_setting('t.rf')::jsonb)), true, 'rf-rf', null);
select is(t_bal('00000000-0000-4000-8000-0000000000f6'), 6000, 'a successful refund restores the points');
select is((select array_agg(delta order by id) from public.coupon_point_transactions
  where order_id = t_oid(current_setting('t.rf')::jsonb) and kind = 'REFUND_RESTORE'), array[1000, 2000], 'one REFUND_RESTORE row per lot');
select is((select array_agg(code_id order by id) from public.coupon_point_transactions where order_id = t_oid(current_setting('t.rf')::jsonb) and kind = 'USE'),
  (select array_agg(code_id order by id) from public.coupon_point_transactions where order_id = t_oid(current_setting('t.rf')::jsonb) and kind = 'REFUND_RESTORE'),
  'to the same lots');
select public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = t_oid(current_setting('t.rf')::jsonb)), true, 'rf-rf', null);
select private.reverse_order_rewards(t_oid(current_setting('t.rf')::jsonb));
select is(t_bal('00000000-0000-4000-8000-0000000000f6'), 6000, 'repeating the refund result or the reversal restores nothing more');
select is(t_sum('00000000-0000-4000-8000-0000000000f6'), 6000, 'balance equals the ledger sum');

-- A fully covered order has no provider refund: cancelling restores at once.
select set_config('t.rz', public.t_order('00000000-0000-4000-8000-0000000000f6', public.t_lines(1, 0), 4500)::text, true);
select is(t_bal('00000000-0000-4000-8000-0000000000f6'), 1500, 'a zero-amount order spends its points at once');
select t_as('00000000-0000-4000-8000-0000000000f6');
select public.customer_cancel_order(t_oid(current_setting('t.rz')::jsonb), 'PAID');
select t_owner();
select is(t_bal('00000000-0000-4000-8000-0000000000f6'), 6000, 'cancelling it restores the points at once');

-- A late approval after the order expired: the points were never spent, so none are restored.
select set_config('t.lt', public.t_order('00000000-0000-4000-8000-0000000000f6', public.t_lines(1, 0), 2000)::text, true);
update public.orders set expires_at = now() - interval '1 second' where id = t_oid(current_setting('t.lt')::jsonb);
select private.expire_order(t_oid(current_setting('t.lt')::jsonb));
select public.t_pay(t_oid(current_setting('t.lt')::jsonb));
select is((select count(*) from public.coupon_point_transactions where order_id = t_oid(current_setting('t.lt')::jsonb)), 0::bigint,
  'a late approval of an expired order writes no point rows');
select is(t_bal('00000000-0000-4000-8000-0000000000f6'), 6000, 'and the balance is unchanged');

-- ===== expiry of points (OQ-30) =====
select public.t_grant('00000000-0000-4000-8000-0000000000f7', 3000, interval '30 days');
select set_config('t.ex1', public.t_grant('00000000-0000-4000-8000-0000000000f7', 4000, interval '30 days')::text, true);
update public.coupon_point_codes set expires_at = now() - interval '1 hour' where id = current_setting('t.ex1')::uuid;
select is(private.usable_points('00000000-0000-4000-8000-0000000000f7'), 3000, 'points of an ended code are not spendable');
select t_as('00000000-0000-4000-8000-0000000000f7');
select is(public.get_my_point_summary() ->> 'balance', '3000', 'the summary excludes them');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, 3500, 'CARD', null)$$,
  'P0001', 'POINTS_EXCEED_BALANCE', 'and checkout cannot spend them');
select t_owner();
select is(t_bal('00000000-0000-4000-8000-0000000000f7'), 7000, 'the stored balance still includes them until the nightly run');
-- A member with an open checkout is skipped.
select set_config('t.ex2', public.t_order('00000000-0000-4000-8000-0000000000f7', public.t_lines(1, 0), 1000)::text, true);
select private.expire_rewards();
select is(t_bal('00000000-0000-4000-8000-0000000000f7'), 7000, 'the nightly run skips a member with an open hold');
select public.apply_payment_result((current_setting('t.ex2')::jsonb ->> 'paymentId')::uuid, 'FAILED', null, null, 'ev-ex2', 'CONFIRM');
select private.expire_rewards();
select is(t_bal('00000000-0000-4000-8000-0000000000f7'), 3000, 'the nightly run then expires the rest of the ended lot');
select is((select row(kind, delta, label)::text from public.coupon_point_transactions where code_id = current_setting('t.ex1')::uuid and kind = 'EXPIRE'),
  '(EXPIRE,-4000,"포인트 소멸")', 'with one EXPIRE row');
select private.expire_rewards();
select is((select count(*) from public.coupon_point_transactions where code_id = current_setting('t.ex1')::uuid and kind = 'EXPIRE'), 1::bigint,
  'running it again expires nothing twice');
select is(t_sum('00000000-0000-4000-8000-0000000000f7'), t_bal('00000000-0000-4000-8000-0000000000f7'), 'balance equals the ledger sum');
select private.add_point_tx('00000000-0000-4000-8000-0000000000f7', 'REFUND_RESTORE', 500, 'x', 'late:restore', current_setting('t.ex1')::uuid);
select private.expire_rewards();
select is(t_bal('00000000-0000-4000-8000-0000000000f7'), 3000, 'points restored into an ended lot are expired by the next run');
select public.t_code('OLIVE-TST3-CCC1', 1000, interval '-1 minute');
select private.expire_rewards();
select is((select status::text from public.coupon_point_codes where code = 'OLIVE-TST3-CCC1'), 'EXPIRED', 'an unused code past its end is marked EXPIRED');

-- ===== admin: issue, list, void (SA-08, OQ-31) =====
select t_as('00000000-0000-4000-8000-0000000000a1');
select set_config('t.b1', public.admin_issue_point_codes(5000, 3, ((now() at time zone 'Asia/Seoul')::date + 30), '테스트 발급')::text, true);
select is(jsonb_array_length(current_setting('t.b1')::jsonb -> 'codes'), 3, 'a batch returns every code once');
select ok((select bool_and(c ->> 'code' ~ '^OLIVE-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$') from jsonb_array_elements(current_setting('t.b1')::jsonb -> 'codes') c),
  'codes use the 32-character alphabet');
select is((select count(distinct c ->> 'code') from jsonb_array_elements(current_setting('t.b1')::jsonb -> 'codes') c), 3::bigint, 'and are unique');
select t_owner();
select is((select row(amount, quantity, memo, created_by)::text from public.coupon_point_code_batches where id = (current_setting('t.b1')::jsonb ->> 'batchId')::uuid),
  '(5000,3,"테스트 발급",00000000-0000-4000-8000-0000000000a1)', 'the batch records amount, quantity, memo and the admin');
select is((select count(*) from public.coupon_point_codes where batch_id = (current_setting('t.b1')::jsonb ->> 'batchId')::uuid and status = 'UNUSED'), 3::bigint,
  'all codes start unused');
select is((select count(distinct expires_at) from public.coupon_point_codes where batch_id = (current_setting('t.b1')::jsonb ->> 'batchId')::uuid), 1::bigint,
  'sharing one end');
select is((select expires_at = (((now() at time zone 'Asia/Seoul')::date + 31)::timestamp at time zone 'Asia/Seoul')
  from public.coupon_point_codes where batch_id = (current_setting('t.b1')::jsonb ->> 'batchId')::uuid limit 1), true,
  'valid through the whole last day (midnight KST after it)');
select t_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.admin_issue_point_codes(999, 1, ((now() at time zone 'Asia/Seoul')::date + 5), '')$$, 'P0001', 'INVALID_INPUT', 'below 1,000 won is invalid');
select throws_ok($$select public.admin_issue_point_codes(100001, 1, ((now() at time zone 'Asia/Seoul')::date + 5), '')$$, 'P0001', 'INVALID_INPUT', 'above 100,000 won is invalid');
select throws_ok($$select public.admin_issue_point_codes(5000, 0, ((now() at time zone 'Asia/Seoul')::date + 5), '')$$, 'P0001', 'INVALID_INPUT', 'zero codes is invalid');
select throws_ok($$select public.admin_issue_point_codes(5000, 51, ((now() at time zone 'Asia/Seoul')::date + 5), '')$$, 'P0001', 'INVALID_INPUT', 'more than 50 codes is invalid');
select throws_ok($$select public.admin_issue_point_codes(5000, 1, (now() at time zone 'Asia/Seoul')::date, '')$$, 'P0001', 'INVALID_INPUT', 'an end date of today or earlier is invalid');
select throws_ok($$select public.admin_issue_point_codes(5000, 1, ((now() at time zone 'Asia/Seoul')::date + 5), repeat('가', 41))$$, 'P0001', 'INVALID_INPUT', 'a memo over 40 characters is invalid');
select lives_ok($$select public.admin_issue_point_codes(100000, 50, ((now() at time zone 'Asia/Seoul')::date + 5), '')$$, 'the limits themselves (100,000 won, 50 codes) are valid');
select set_config('t.list', public.admin_list_point_codes('UNUSED', '테스트 발급', 50, 0)::text, true);
select is(jsonb_array_length(current_setting('t.list')::jsonb -> 'codes'), 3, 'the list filters by status and memo');
select ok(position((current_setting('t.b1')::jsonb -> 'codes' -> 0 ->> 'code') in current_setting('t.list')) = 0,
  'the list does not repeat a full code');
select ok((current_setting('t.list')::jsonb -> 'codes' -> 0 ->> 'maskedCode') like 'OLIVE-••••-____', 'it shows a masked code');
select is(jsonb_array_length(public.admin_list_point_codes(null, current_setting('t.b1')::jsonb -> 'codes' -> 0 ->> 'code', 10, 0) -> 'codes'), 1,
  'but a full code typed by the admin finds its code');
select is(jsonb_array_length(public.admin_list_point_codes(null, null, 10, 0) -> 'codes'), 10, 'the list is paged');
select cmp_ok((public.admin_list_point_codes(null, null, 10, 0) ->> 'matching')::int, '>', 10, 'and reports how many codes match, beyond the page');
select is((public.admin_list_point_codes('UNUSED', '테스트 발급', 50, 0) ->> 'matching')::int, 3, 'matching follows the filter, while totals do not');
select throws_ok($$select public.admin_list_point_codes('NOPE')$$, 'P0001', 'INVALID_INPUT', 'an unknown status filter is invalid');
select is(public.admin_list_point_codes('EXHAUSTED', 'OLIVE-TST1-AAA1') -> 'codes' -> 0 ->> 'status', null, 'a registered code with points left is not exhausted');
select is(public.admin_list_point_codes('REGISTERED', 'OLIVE-TST1-AAA1') -> 'codes' -> 0 ->> 'status', 'REGISTERED', 'it is REGISTERED');
select is(public.admin_list_point_codes(null, 'OLIVE-TST1-AAA1') -> 'codes' -> 0 ->> 'remaining', '4900', 'with the remainder derived from the ledger');
select is(public.admin_list_point_codes(null, 'OLIVE-TST1-AAA3') -> 'codes' -> 0 ->> 'status', 'EXPIRED', 'an ended code shows as EXPIRED');
select is(public.admin_list_point_codes(null, 'OLIVE-TST1-AAA4') -> 'codes' -> 0 ->> 'status', 'VOID', 'a voided code shows as VOID');
select ok((public.admin_list_point_codes() -> 'totals' ->> 'issued')::int > 0 and (public.admin_list_point_codes() -> 'totals' ->> 'remaining')::int > 0,
  'the totals cover issued and remaining points');

-- Void.
select set_config('t.vid', (current_setting('t.b1')::jsonb -> 'codes' -> 0 ->> 'id'), true);
select set_config('t.vcode', (current_setting('t.b1')::jsonb -> 'codes' -> 0 ->> 'code'), true);
select is(public.admin_void_point_code(current_setting('t.vid')::uuid) ->> 'status', 'VOID', 'an unused code can be voided');
select is(public.admin_void_point_code(current_setting('t.vid')::uuid) ->> 'status', 'VOID', 'voiding twice is harmless');
select throws_ok(format($$select public.admin_void_point_code(%L)$$, (select id from public.coupon_point_codes where code = 'OLIVE-TST1-AAA1')),
  'P0001', 'CODE_ALREADY_REGISTERED', 'OQ-31 a registered code cannot be voided');
select throws_ok($$select public.admin_void_point_code(gen_random_uuid())$$, 'P0001', 'NOT_FOUND', 'an unknown code is not found');
select t_as('00000000-0000-4000-8000-0000000000f2');
select is(public.register_coupon_point_code(current_setting('t.vcode')) ->> 'errorCode', 'CODE_VOID', 'a voided code cannot be registered');
select t_owner();
select is((select row(status, voided_by)::text from public.coupon_point_codes where id = current_setting('t.vid')::uuid),
  '(VOID,00000000-0000-4000-8000-0000000000a1)', 'the void records the admin');
select is((select count(*) from public.admin_audit_log where entity = 'coupon_point_codes' and entity_id = current_setting('t.vid')), 1::bigint, 'the void is audited');
select is((select count(*) from public.admin_audit_log where entity like 'coupon_point_code%' and after::text like '%' || current_setting('t.vcode') || '%'), 0::bigint,
  'audit rows never contain a code');

-- Policy.
select t_as('00000000-0000-4000-8000-0000000000a1');
select lives_ok($$update public.coupon_point_policy set min_use_amount = 1000, use_unit = 100, max_use_per_order = 20000$$, 'admin: edits the use rules');
select throws_ok($$update public.coupon_point_policy set registration_attempt_limit = 99$$, '42501', null, 'admin: cannot change the brute-force limit');
select throws_ok($$update public.coupon_point_policy set use_unit = 0$$, '23514', null, 'a unit below 1 violates the check');
select throws_ok($$delete from public.coupon_point_policy$$, '42501', null, 'the policy cannot be deleted');
select t_owner();
select is((select row(min_use_amount, use_unit, max_use_per_order)::text from public.coupon_point_policy where id = 1), '(1000,100,20000)', 'the rules were saved');
select is((select count(*) from public.admin_audit_log where entity = 'coupon_point_policy'
  and after ->> 'use_unit' = '100' and after ->> 'max_use_per_order' = '20000'), 1::bigint, 'and audited');
update public.coupon_point_policy set min_use_amount = 0, use_unit = 1, max_use_per_order = null;

-- ===== RLS (plan 11.1) =====
select t_as('00000000-0000-4000-8000-0000000000f5');
select is((select count(*) from public.coupon_point_transactions), (select count(*) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-0000000000f5'),
  'customer: reads only their own ledger');
select cmp_ok((select count(*) from public.coupon_point_transactions), '>=', 2::bigint, 'customer: and can read it');
select is((select count(*) from public.coupon_point_balances), 1::bigint, 'customer: reads only their own balance');
select cmp_ok((select count(*) from public.coupon_point_holds), '>=', 1::bigint, 'customer: reads their own holds');
select is((select count(*) from public.coupon_point_holds where user_id <> '00000000-0000-4000-8000-0000000000f5'), 0::bigint, 'customer: not others'' holds');
select is((select count(*) from public.coupon_point_codes), 0::bigint, 'customer: cannot read any code (codes are not enumerable)');
select is((select count(*) from public.coupon_point_code_batches), 0::bigint, 'customer: cannot read batches');
select throws_ok($$select * from public.coupon_point_code_attempts$$, '42501', null, 'customer: no access to the attempt log');
select is((select min_use_amount from public.coupon_point_policy), 0, 'customer: reads the use rules');
select is(public.t_policy_updates(), 0::bigint, 'customer: cannot edit the use rules (no row is updatable)');
select throws_ok($$insert into public.coupon_point_transactions (user_id, kind, delta, balance_after, code_id, lot_expires_at, idempotency_key, label)
  values ('00000000-0000-4000-8000-0000000000f5', 'REGISTER', 100000, 100000, (select id from public.coupon_point_codes limit 1), now(), 'cheat', 'x')$$,
  '42501', null, 'customer: cannot write the ledger');
select throws_ok($$update public.coupon_point_balances set balance = 999999$$, '42501', null, 'customer: cannot write balances');
select throws_ok($$insert into public.coupon_point_holds (order_id, user_id, amount) values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000f5', 1)$$,
  '42501', null, 'customer: cannot write holds');
select throws_ok($$update public.coupon_point_codes set status = 'UNUSED'$$, '42501', null, 'customer: cannot change codes');
select throws_ok($$select public.admin_issue_point_codes(5000, 1, ((now() at time zone 'Asia/Seoul')::date + 5), '')$$, 'P0001', 'FORBIDDEN', 'customer: cannot issue codes');
select throws_ok($$select public.admin_list_point_codes()$$, 'P0001', 'FORBIDDEN', 'customer: cannot list codes');
select throws_ok($$select public.admin_void_point_code(gen_random_uuid())$$, 'P0001', 'FORBIDDEN', 'customer: cannot void codes');
select throws_ok($$select private.register_point_code('00000000-0000-4000-8000-0000000000f5', 'OLIVE-TST2-BBB1')$$, '42501', null, 'customer: cannot call the internal registration');
select throws_ok($$select private.capture_point_hold(gen_random_uuid())$$, '42501', null, 'customer: cannot call the internal capture');
select throws_ok($$select private.add_point_tx('00000000-0000-4000-8000-0000000000f5', 'REGISTER', 100, 'x', 'cheat:2', (select id from public.coupon_point_codes limit 1))$$,
  '42501', null, 'customer: cannot call the ledger writer');
select t_owner();

select t_as('00000000-0000-4000-8000-0000000000f2');
select is((select count(*) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-0000000000f5'), 0::bigint, 'other customer: cannot read someone else''s ledger');
select is((select count(*) from public.coupon_point_balances where user_id = '00000000-0000-4000-8000-0000000000f5'), 0::bigint, 'other customer: nor their balance');
select is((select count(*) from public.coupon_point_holds where user_id = '00000000-0000-4000-8000-0000000000f5'), 0::bigint, 'other customer: nor their holds');
select t_owner();

select t_as('00000000-0000-4000-8000-0000000000b1');
select is((select count(*) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-0000000000f5'), 0::bigint, 'staff: cannot read member ledgers');
select is((select count(*) from public.coupon_point_balances where user_id = '00000000-0000-4000-8000-0000000000f5'), 0::bigint, 'staff: nor balances');
select is((select count(*) from public.coupon_point_holds), 0::bigint, 'staff: nor holds');
select is((select count(*) from public.coupon_point_codes), 0::bigint, 'staff: nor codes');
select is((select count(*) from public.coupon_point_code_batches), 0::bigint, 'staff: nor batches');
select is(public.t_policy_updates(), 0::bigint, 'staff: cannot edit the use rules');
select throws_ok($$select public.admin_issue_point_codes(5000, 1, ((now() at time zone 'Asia/Seoul')::date + 5), '')$$, 'P0001', 'FORBIDDEN', 'staff: cannot issue codes');
select throws_ok($$select public.admin_list_point_codes()$$, 'P0001', 'FORBIDDEN', 'staff: cannot list codes');
select is((select points_used from public.orders where id = t_oid(current_setting('t.z1')::jsonb)), 6000, 'staff: still reads the points used on a paid order');
select t_owner();

select t_as('00000000-0000-4000-8000-0000000000a1');
select cmp_ok((select count(*) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-0000000000f5'), '>=', 2::bigint, 'admin: reads any member ledger');
select is((select balance from public.coupon_point_balances where user_id = '00000000-0000-4000-8000-0000000000f5'), 3000, 'admin: reads any balance');
select cmp_ok((select count(*) from public.coupon_point_codes), '>=', 5::bigint, 'admin: reads codes');
select cmp_ok((select count(*) from public.coupon_point_code_batches), '>=', 1::bigint, 'admin: reads batches');
select throws_ok($$select * from public.coupon_point_code_attempts$$, '42501', null, 'admin: the attempt log is not readable either');
select throws_ok($$update public.coupon_point_codes set status = 'UNUSED'$$, '42501', null, 'admin: cannot rewrite codes directly');
select throws_ok($$insert into public.coupon_point_transactions (user_id, kind, delta, balance_after, code_id, lot_expires_at, idempotency_key, label)
  values ('00000000-0000-4000-8000-0000000000f5', 'ADJUST', 100, 100, (select id from public.coupon_point_codes limit 1), now(), 'adj', 'x')$$,
  '42501', null, 'admin: no manual adjustments (OQ-33)');
select t_owner();

select t_anon();
select throws_ok($$select * from public.coupon_point_policy$$, '42501', null, 'anon: no policy');
select throws_ok($$select * from public.coupon_point_codes$$, '42501', null, 'anon: no codes');
select throws_ok($$select * from public.coupon_point_code_batches$$, '42501', null, 'anon: no batches');
select throws_ok($$select * from public.coupon_point_balances$$, '42501', null, 'anon: no balances');
select throws_ok($$select * from public.coupon_point_transactions$$, '42501', null, 'anon: no ledger');
select throws_ok($$select * from public.coupon_point_holds$$, '42501', null, 'anon: no holds');
select throws_ok($$select * from public.coupon_point_code_attempts$$, '42501', null, 'anon: no attempts');
select throws_ok($$select public.admin_list_point_codes()$$, '42501', null, 'anon: cannot list codes');
select throws_ok($$select public.admin_issue_point_codes(5000, 1, current_date + 5, '')$$, '42501', null, 'anon: cannot issue codes');
select t_owner();

-- ===== realtime hint =====
select cmp_ok((select count(*) from realtime.messages where topic = 'user:00000000-0000-4000-8000-0000000000f5'
  and event = 'reward_updated' and payload ->> 'asset' = 'POINT'), '>=', 1::bigint, 'a point change sends reward_updated {asset: POINT} to the member');
select is((select array(select k from jsonb_object_keys(payload - 'id') k order by k) from realtime.messages
  where topic = 'user:00000000-0000-4000-8000-0000000000f5' and event = 'reward_updated' and payload ->> 'asset' = 'POINT' limit 1), array['asset'],
  'the hint carries only the asset kind');

-- ===== Coupon Points and Olive Stamps share nothing (CLAUDE.md hard rule) =====
select is((select count(*) from pg_constraint c
  join pg_class a on a.oid = c.conrelid join pg_class b on b.oid = c.confrelid
  where c.contype = 'f' and a.relnamespace = 'public'::regnamespace
    and ((a.relname like 'coupon_point%' and (b.relname like 'stamp%' or b.relname in ('coupons', 'user_coupons')))
      or ((a.relname like 'stamp%' or a.relname in ('coupons', 'user_coupons')) and b.relname like 'coupon_point%'))), 0::bigint,
  'no foreign key links a point table with a stamp or coupon table');
select is((select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid
  where c.relnamespace = 'public'::regnamespace and c.relname in ('coupon_point_transactions', 'stamp_transactions') and a.attname = 'kind'
    and a.atttypid = (select oid from pg_type where typname = 'stamp_tx_kind')), 1::bigint,
  'the two ledgers use different kind enums (stamp_tx_kind only on stamps)');
select is((select count(*) from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
  and (p.proname like '%point%') and p.prosrc ~* '(^|[^a-z])stamp'), 0::bigint, 'no function named for points mentions stamps');
select is((select count(*) from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
  and (p.proname like '%stamp%') and p.prosrc ~* 'coupon_point'), 0::bigint, 'and no stamp function mentions points');

select * from finish();
rollback;
