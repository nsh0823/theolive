-- Phase (f) account deletion (AUTH-04, OQ-34; plan section 3.4). The `account-delete` Edge Function verifies the
-- caller's JWT and calls `delete_account` with that user's id; everything it does is in this SQL function.
-- Requirements: refused while an order is in progress; unpaid checkouts cancelled; rewards forfeited on both separate
-- ledgers; personal data scrubbed; orders and payments retained; the login ended; idempotent; a profile is never
-- hard-deleted while it has history.
-- Everything runs with members created here (ids 91..96), and every assertion looks only at their rows, so rows
-- committed by other suites (API integration runs, the seed) never change the result. The real sign-in refusal and
-- the Edge Function are covered by packages/api/src/account.integration.test.ts.
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

insert into auth.users (id, instance_id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'delete' || n || '@example.test', case when n = '91' then '+821099998888' end,
       '{"provider":"kakao","providers":["kakao"]}', jsonb_build_object('nickname', 'ZQX탈퇴' || n)
  from (values ('91'), ('92'), ('93'), ('94'), ('95'), ('96')) v(n);
-- Member 91 also has a login identity, a session and a refresh token.
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000091', 'kakao-91', 'kakao', '{"sub":"kakao-91"}', now(), now(), now());
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000e01', '00000000-0000-4000-8000-000000000091', now(), now());

create function public.t_lines(p_americano int, p_latte int) returns jsonb language sql as $$
  select coalesce(jsonb_agg(l), '[]'::jsonb) from (
    select jsonb_build_object('menuItemId', '00000000-0000-4000-8000-000000000201', 'temperature', 'HOT', 'quantity', p_americano) l
      where p_americano > 0
    union all
    select jsonb_build_object('menuItemId', '00000000-0000-4000-8000-000000000203', 'temperature', 'ICE', 'quantity', p_latte)
      where p_latte > 0) x;
$$;
create function public.t_order(p_uid text, p_lines jsonb, p_points int default 0, p_coupon uuid default null, p_note text default null)
returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as(p_uid);
  r := public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', p_lines, p_coupon, p_points, 'CARD', p_note);
  perform public.t_owner();
  return r;
end $$;
create function public.t_pay(p_order uuid) returns jsonb language sql as $$
  select public.apply_payment_result(p.id, 'APPROVED', 'tp-' || p.id, p.amount, 'ev-' || p.id, 'CONFIRM')
    from public.payments p where p.order_id = p_order;
$$;
create function public.t_staff(p_order uuid, p_action text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as('00000000-0000-4000-8000-0000000000b2');
  r := public.staff_transition_order(p_order, p_action, (select status from public.orders where id = p_order), null, null);
  perform public.t_owner();
  return r;
end $$;
create function public.t_rows(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
create function public.t_oid(p_order jsonb) returns uuid language sql as $$ select (p_order ->> 'orderId')::uuid $$;
create function public.t_code(p_code text, p_amount int) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.coupon_point_codes (batch_id, code, amount, expires_at)
  values ('00000000-0000-4000-8000-000000000951', p_code, p_amount, now() + interval '90 days') returning id into v_id;
  return v_id;
end $$;
create function public.t_del(p_uid text) returns jsonb language sql as $$ select public.delete_account(p_uid::uuid) $$;
create function public.t_stamps(p_uid text) returns integer language sql as $$
  select coalesce((select balance from public.stamp_balances where user_id = p_uid::uuid), 0);
$$;
create function public.t_points(p_uid text) returns integer language sql as $$
  select coalesce((select balance from public.coupon_point_balances where user_id = p_uid::uuid), 0);
$$;

select plan(73);

update public.store_settings set is_open = true, is_accepting_orders = true, pending_payment_ttl_minutes = 15;
update public.coupon_point_policy set min_use_amount = 0, use_unit = 1, max_use_per_order = null;
insert into public.coupons (id, title, required_stamps, valid_days, benefit_type, discount_amount)
values ('00000000-0000-4000-8000-000000000963', 'T 정액 3000', 2, 30, 'FIXED_AMOUNT', 3000);
insert into public.coupon_point_code_batches (id, amount, quantity, expires_at, memo)
values ('00000000-0000-4000-8000-000000000951', 5000, 1, now() + interval '400 days', 'pgTAP');


-- ===== member 91: a full account =====
select private.add_stamp_tx('00000000-0000-4000-8000-000000000091', 'EARN', 5, 'test credit', 'tg:' || gen_random_uuid());
select set_config('t.coupon', (private.issue_coupon_for_stamps('00000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000963', gen_random_uuid()) ->> 'userCouponId'), true);
select public.t_code('OLIVE-DEL1-AAA1', 3000);
select public.t_code('OLIVE-DEL1-AAA2', 2000);
select public.t_code('OLIVE-DEL1-AAA3', 1500);
select private.register_point_code('00000000-0000-4000-8000-000000000091', 'OLIVE-DEL1-AAA1');
select private.register_point_code('00000000-0000-4000-8000-000000000091', 'OLIVE-DEL1-AAA2');
select private.register_point_code('00000000-0000-4000-8000-000000000091', 'OLIVE-DEL1-AAA3');
-- A lot that ended but was not expired by the nightly job yet still counts in the projection.
update public.coupon_point_codes set expires_at = now() - interval '1 hour' where code = 'OLIVE-DEL1-AAA3';
insert into public.notification_preferences (user_id, order_updates, notices) values ('00000000-0000-4000-8000-000000000091', true, false);
update public.profiles set avatar_url = 'https://example.test/a.png', username = 'zqxuser91' where id = '00000000-0000-4000-8000-000000000091';
select set_config('t.o1', public.t_order('00000000-0000-4000-8000-000000000091', public.t_lines(1, 1), 0, null, 'ZQX 홍길동 님 앞')::text, true);
select public.t_pay(public.t_oid(current_setting('t.o1')::jsonb));
select public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'ACCEPT');
select public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'START_PREPARING');
select public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'MARK_READY');
select public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'COMPLETE');
-- An unpaid checkout that holds the coupon and 1,000 points.
select set_config('t.p', public.t_order('00000000-0000-4000-8000-000000000091', public.t_lines(2, 0), 1000, current_setting('t.coupon')::uuid)::text, true);
select is((select status::text from public.user_coupons where id = current_setting('t.coupon')::uuid), 'RESERVED', 'setup: the coupon is reserved by the unpaid order');
select is((select status::text from public.coupon_point_holds where order_id = public.t_oid(current_setting('t.p')::jsonb)), 'HELD', 'setup: 1,000 points are held');
select is(public.t_stamps('00000000-0000-4000-8000-000000000091'), 4, 'setup: 5 - 2 (coupon) + 1 (completed order) = 4 stamps');
select is(public.t_points('00000000-0000-4000-8000-000000000091'), 6500, 'setup: 3,000 + 2,000 + 1,500 points');
select cmp_ok((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-000000000091'), '>=', 5::bigint, 'setup: the member has notifications');
select set_config('t.orders_before', (select count(*) from public.orders where customer_id = '00000000-0000-4000-8000-000000000091')::text, true);
select set_config('t.items_before', (select count(*) from public.order_items oi join public.orders o on o.id = oi.order_id where o.customer_id = '00000000-0000-4000-8000-000000000091')::text, true);
select set_config('t.pay_before', (select count(*) from public.payments p join public.orders o on o.id = p.order_id where o.customer_id = '00000000-0000-4000-8000-000000000091')::text, true);

-- ===== refusals =====
select throws_ok($$select public.t_del('00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'STAFF_ACCOUNT_NOT_ALLOWED', 'a staff account cannot be deleted this way');
select throws_ok($$select public.t_del('00000000-0000-4000-8000-0000000000ee')$$, 'P0001', 'NOT_FOUND', 'an unknown account is NOT_FOUND');
select throws_ok($$select public.t_del(null)$$, 'P0001', 'NOT_FOUND', 'no id is NOT_FOUND');

-- Member 92: refused at every in-progress stage, nothing changes, then allowed once the order is finished.
select private.add_stamp_tx('00000000-0000-4000-8000-000000000092', 'EARN', 3, 'test credit', 'tg:' || gen_random_uuid());
select set_config('t.a', public.t_order('00000000-0000-4000-8000-000000000092', public.t_lines(1, 0))::text, true);
select public.t_pay(public.t_oid(current_setting('t.a')::jsonb));
select throws_ok($$select public.t_del('00000000-0000-4000-8000-000000000092')$$, 'P0001', 'ACTIVE_ORDER_EXISTS', 'refused while an order is PAID');
select public.t_staff(public.t_oid(current_setting('t.a')::jsonb), 'ACCEPT');
select throws_ok($$select public.t_del('00000000-0000-4000-8000-000000000092')$$, 'P0001', 'ACTIVE_ORDER_EXISTS', 'refused while ACCEPTED');
select public.t_staff(public.t_oid(current_setting('t.a')::jsonb), 'START_PREPARING');
select throws_ok($$select public.t_del('00000000-0000-4000-8000-000000000092')$$, 'P0001', 'ACTIVE_ORDER_EXISTS', 'refused while PREPARING');
select public.t_staff(public.t_oid(current_setting('t.a')::jsonb), 'MARK_READY');
select throws_ok($$select public.t_del('00000000-0000-4000-8000-000000000092')$$, 'P0001', 'ACTIVE_ORDER_EXISTS', 'refused while READY');
select is((select deleted_at from public.profiles where id = '00000000-0000-4000-8000-000000000092'), null::timestamptz, 'a refused deletion leaves the profile alone');
select is(public.t_stamps('00000000-0000-4000-8000-000000000092'), 3, 'and the balance');
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-000000000092' and kind = 'FORFEIT'), 0::bigint, 'and writes no forfeit row');
select is((select banned_until from auth.users where id = '00000000-0000-4000-8000-000000000092'), null::timestamptz, 'and does not touch the login');
select public.t_staff(public.t_oid(current_setting('t.a')::jsonb), 'COMPLETE');
select is(public.t_del('00000000-0000-4000-8000-000000000092') ->> 'deleted', 'true', 'after the order is completed the deletion goes through');

-- ===== member 91: the deletion =====
select is(public.t_del('00000000-0000-4000-8000-000000000091'), '{"deleted": true, "isReplay": false}'::jsonb, 'deletes the account');

-- unpaid checkout
select is((select status::text from public.orders where id = public.t_oid(current_setting('t.p')::jsonb)), 'CANCELLED', 'the unpaid checkout is cancelled');
select is((select cancel_reason from public.orders where id = public.t_oid(current_setting('t.p')::jsonb)), 'ACCOUNT_DELETED', 'with its reason');
select is((select status::text from public.payments where order_id = public.t_oid(current_setting('t.p')::jsonb)), 'CANCELLED', 'and its payment');
select is((select failure_code from public.payments where order_id = public.t_oid(current_setting('t.p')::jsonb)), 'CUSTOMER_CANCELLED',
  'so that a late approval is refunded like any customer cancellation');
select is((select status::text from public.coupon_point_holds where order_id = public.t_oid(current_setting('t.p')::jsonb)), 'RELEASED', 'the point hold is released');

-- Olive Stamps ledger
select is(public.t_stamps('00000000-0000-4000-8000-000000000091'), 0, 'stamp balance is 0');
select is((select row(kind, delta, balance_after, label, idempotency_key)::text from public.stamp_transactions where user_id = '00000000-0000-4000-8000-000000000091' and kind = 'FORFEIT'),
  '(FORFEIT,-4,0,"탈퇴로 소멸",forfeit:00000000-0000-4000-8000-000000000091)', 'one stamp FORFEIT row for exactly the stamps left');
select is((select coalesce(sum(delta), 0) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'the stamp ledger sums to the balance');
-- Coupon Points ledger (a separate ledger with its own rows)
select is(public.t_points('00000000-0000-4000-8000-000000000091'), 0, 'point balance is 0');
select is((select array_agg(delta order by delta) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-000000000091' and kind = 'FORFEIT'), array[-3000, -2000, -1500],
  'one point FORFEIT row per lot, including the lot that had ended');
select is((select count(distinct code_id) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-000000000091' and kind = 'FORFEIT'), 3::bigint, 'each on its own lot');
select is((select coalesce(sum(delta), 0) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'the point ledger sums to the balance');
select is((select count(*) from (select code_id from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-000000000091' group by code_id having sum(delta) <> 0) x), 0::bigint, 'every lot is at 0');
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-000000000091' and kind = 'FORFEIT' and delta <> -4), 0::bigint, 'the stamp forfeit never includes points');
select is((select status::text from public.user_coupons where id = current_setting('t.coupon')::uuid), 'VOID', 'the unused coupon is void');
select is((select count(*) from public.user_coupons where user_id = '00000000-0000-4000-8000-000000000091' and status in ('AVAILABLE', 'RESERVED')), 0::bigint, 'no usable coupon is left');

-- personal data
select is((select row(nickname, avatar_url, username, deleted_at is not null)::text from public.profiles where id = '00000000-0000-4000-8000-000000000091'), '("탈퇴한 회원",,,t)',
  'the profile is scrubbed and marked deleted, not removed');
select is((select note from public.orders where id = public.t_oid(current_setting('t.o1')::jsonb)), null::text, 'the free-text order note is scrubbed');
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'notifications are deleted');
select is((select count(*) from public.notification_preferences where user_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'and preferences');
select is((select row(email, phone, raw_user_meta_data::text, encrypted_password)::text from auth.users where id = '00000000-0000-4000-8000-000000000091'),
  '(deleted-00000000-0000-4000-8000-000000000091@deleted.invalid,,{},"")', 'the auth user keeps no email, phone, metadata or password');
select ok((select banned_until > now() + interval '50 years' from auth.users where id = '00000000-0000-4000-8000-000000000091'), 'and is banned for good');
select is((select count(*) from auth.identities where user_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'the login identity is removed');
select is((select count(*) from auth.sessions where user_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'and the session (the session ends)');
select is((select count(*) from auth.users where id = '00000000-0000-4000-8000-000000000091'), 1::bigint, 'the auth user and profile still exist: nothing is hard-deleted');

-- retention
select is((select count(*) from public.orders where customer_id = '00000000-0000-4000-8000-000000000091')::text, current_setting('t.orders_before'), 'orders are retained');
select is((select count(*) from public.order_items oi join public.orders o on o.id = oi.order_id where o.customer_id = '00000000-0000-4000-8000-000000000091')::text, current_setting('t.items_before'), 'with their items');
select is((select count(*) from public.payments p join public.orders o on o.id = p.order_id where o.customer_id = '00000000-0000-4000-8000-000000000091')::text, current_setting('t.pay_before'), 'and payments');
select is((select status::text from public.orders where id = public.t_oid(current_setting('t.o1')::jsonb)), 'COMPLETED', 'a finished order is untouched');

-- idempotent
select is(public.t_del('00000000-0000-4000-8000-000000000091'), '{"deleted": true, "isReplay": true}'::jsonb, 'deleting again is a no-op');
select is((select count(*) from public.stamp_transactions where user_id = '00000000-0000-4000-8000-000000000091' and kind = 'FORFEIT'), 1::bigint, 'with no second stamp forfeit');
select is((select count(*) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-000000000091' and kind = 'FORFEIT'), 3::bigint, 'and no second point forfeit');

-- a late approval of the cancelled checkout is refunded and notifies nobody
select public.apply_payment_result((select id from public.payments where order_id = public.t_oid(current_setting('t.p')::jsonb)),
  'APPROVED', 'late-p', (select amount from public.payments where order_id = public.t_oid(current_setting('t.p')::jsonb)), 'ev-late-p', 'CONFIRM');
select is((select count(*) from public.refunds r join public.payments p on p.id = r.payment_id where p.order_id = public.t_oid(current_setting('t.p')::jsonb)), 1::bigint,
  'a late approval of the cancelled checkout is refunded');
select public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id where p.order_id = public.t_oid(current_setting('t.p')::jsonb)), true, 'rf-late', null);
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-000000000091'), 0::bigint, 'and a deleted account is never notified again');
select is(public.t_stamps('00000000-0000-4000-8000-000000000091') + public.t_points('00000000-0000-4000-8000-000000000091'), 0, 'the refund does not give the deleted member rewards back');

-- ===== after the deletion, with the old token still valid =====
select t_as('00000000-0000-4000-8000-000000000091');
select is((select count(*) from public.profiles), 0::bigint, 'cannot read the profile');
select is((select count(*) from public.orders), 0::bigint, 'cannot read orders');
select is((select count(*) from public.stamp_transactions) + (select count(*) from public.stamp_balances) + (select count(*) from public.user_coupons), 0::bigint, 'cannot read stamps or coupons');
select is((select count(*) from public.coupon_point_transactions) + (select count(*) from public.coupon_point_balances) + (select count(*) from public.coupon_point_holds), 0::bigint, 'cannot read points');
select throws_ok($$insert into public.notification_preferences (user_id) values ('00000000-0000-4000-8000-000000000091')$$, '42501', null, 'cannot write preferences');
select is(public.t_rows($q$update public.profiles set nickname = 'back'$q$), 0::bigint, 'cannot rename');
select throws_ok($$select public.create_checkout_order(gen_random_uuid(), 'TAKEOUT', public.t_lines(1, 0), null, 0, 'CARD', null)$$, 'P0001', 'FORBIDDEN', 'cannot order');
select t_owner();
insert into public.coupon_point_codes (batch_id, code, amount, expires_at)
values ('00000000-0000-4000-8000-000000000951', 'OLIVE-DEL1-BBB1', 1000, now() + interval '90 days');
select t_as('00000000-0000-4000-8000-000000000091');
select throws_ok($$select public.register_coupon_point_code('OLIVE-DEL1-BBB1')$$, 'P0001', 'FORBIDDEN', 'cannot register a point code');
select t_as('00000000-0000-4000-8000-000000000093');
select is((select count(*) from public.profiles), 1::bigint, 'other members are unaffected');
select t_owner();
select is((select status::text from public.coupon_point_codes where code = 'OLIVE-DEL1-BBB1'), 'UNUSED', 'and the code stays unused');

-- admin view
select t_as('00000000-0000-4000-8000-0000000000a1');
select is((public.admin_list_members('ZQX탈퇴91') ->> 'total')::int, 0, 'a deleted account is not listed as a member');
select throws_ok($$select public.admin_get_member('00000000-0000-4000-8000-000000000091')$$, 'P0001', 'NOT_FOUND', 'nor can it be opened');
select t_owner();

-- ===== access to the function and to hard deletes =====
select t_as('00000000-0000-4000-8000-000000000093');
select throws_ok($$select public.delete_account('00000000-0000-4000-8000-000000000094')$$, '42501', null, 'a customer cannot call delete_account (not even for themselves)');
select throws_ok($$select private.delete_account('00000000-0000-4000-8000-000000000094')$$, '42501', null, 'nor the internal one');
select t_anon();
select throws_ok($$select public.delete_account('00000000-0000-4000-8000-000000000094')$$, '42501', null, 'anon cannot');
select t_owner();
select is(has_function_privilege('service_role', 'public.delete_account(uuid)', 'execute'), true, 'only the service role can');
select throws_ok($$delete from auth.users where id = '00000000-0000-4000-8000-000000000091'$$, 'P0001', 'ACCOUNT_DELETE_REQUIRED', 'a profile with history cannot be hard-deleted');
select is((select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000091'), 1::bigint, 'it is still there');
select lives_ok($$delete from auth.users where id = '00000000-0000-4000-8000-000000000096'$$, 'a profile without any history can be removed');
select is((select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000096'), 0::bigint, 'with its profile');

select * from finish();
rollback;
