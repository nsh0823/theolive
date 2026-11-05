-- Phase (f) notifications, preferences, announcements and the reward summary (plan sections 1.10, 2, 3.1, 6).
-- Requirements: OTH-03 (notices), OTH-05 (notification preferences), HOME-01/02/04, OQ-37 (in-app list only).
-- Everything runs with members created here (ids e1..e6) and announcements created here, and every assertion looks
-- only at their rows, so rows committed by other suites (API integration runs, the seed) never change the result.
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

-- Members: e1 the full order flow, e2 switched order updates off, e3 default preferences, e4 reward summary,
-- e5 switched notices off, e6 outsider.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('00000000-0000-4000-8000-0000000000e' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'notify' || n || '@example.test', '{}'
  from generate_series(1, 6) n;

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
create function public.t_rows(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
create function public.t_oid(p_order jsonb) returns uuid language sql as $$ select (p_order ->> 'orderId')::uuid $$;
create function public.t_n(p_uid text, p_kind text default null) returns bigint language sql as $$
  select count(*) from public.notifications where user_id = p_uid::uuid and (p_kind is null or kind::text = p_kind);
$$;

select plan(95);

update public.store_settings set is_open = true, is_accepting_orders = true, pending_payment_ttl_minutes = 15;
update public.coupon_point_policy set min_use_amount = 0, use_unit = 1, max_use_per_order = null;

-- ===== one order, one notification per event (OTH-03) =====
select set_config('t.o1', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 1))::text, true);
select is(public.t_n('00000000-0000-4000-8000-0000000000e1'), 0::bigint, 'an unpaid checkout notifies nobody');
select public.t_pay(public.t_oid(current_setting('t.o1')::jsonb));
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'PAYMENT'), 1::bigint, 'payment completed: one PAYMENT notification');
select is((select title from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'PAYMENT'),
  (select private.format_won(o.paid_amount) || ' 결제가 완료되었어요. (' || o.order_number || ')' from public.orders o
    where o.id = public.t_oid(current_setting('t.o1')::jsonb)), 'it names the amount and the order number');
select is((select order_id from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'PAYMENT'),
  public.t_oid(current_setting('t.o1')::jsonb), 'and points at the order');
select is((select is_read from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'PAYMENT'),
  false, 'new notifications are unread');
select public.t_pay(public.t_oid(current_setting('t.o1')::jsonb));
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'PAYMENT'), 1::bigint, 'a duplicate payment callback does not notify again');

select public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'ACCEPT');
select is((select title from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'ORDER'),
  '주문이 접수되었어요. (' || (select order_number from public.orders where id = public.t_oid(current_setting('t.o1')::jsonb)) || ')',
  'accepted: "주문이 접수되었어요."');
select is(public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'ACCEPT') ->> 'isReplay', 'true', 'accepting again is a replay');
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'ORDER'), 1::bigint, 'and creates no second notification');
select public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'START_PREPARING');
select public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'MARK_READY');
select ok((select title like '메뉴가 준비되었어요. (%) 픽업대에서 메뉴를 픽업해 주세요.' from public.notifications
  where user_id = '00000000-0000-4000-8000-0000000000e1' and dedupe_key like 'order:%:READY'), 'ready: pickup message with the number');
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'STAMP'), 0::bigint, 'no stamp yet: stamps are earned at COMPLETED');
select public.t_staff(public.t_oid(current_setting('t.o1')::jsonb), 'COMPLETE');
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'ORDER'), 4::bigint, 'accepted, preparing, ready, completed: four ORDER notifications');
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'STAMP'), 1::bigint, 'completing earns one stamp and notifies once');
select is((select title from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'STAMP'),
  '올리브 스탬프 1개가 적립되었어요.', 'stamp message');
select is((select count(*) from (select dedupe_key from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1'
  group by dedupe_key having count(*) > 1) d), 0::bigint, 'no dedupe key repeats');

-- ===== the same source event cannot notify twice =====
select isnt(private.notify('00000000-0000-4000-8000-0000000000e1', 'ORDER', 'x', '', null, 'test:once'), null::uuid, 'a first notification with a key is stored');
select is(private.notify('00000000-0000-4000-8000-0000000000e1', 'ORDER', 'y', '', null, 'test:once'), null::uuid, 'the same key again returns nothing');
select is((select title from public.notifications where dedupe_key = 'test:once'), 'x', 'and keeps the first one');
select is(private.notify(null, 'ORDER', 'z', '', null, 'test:nobody'), null::uuid, 'no recipient: nothing');

-- ===== rejected order with a refund =====
select set_config('t.o2', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0))::text, true);
select public.t_pay(public.t_oid(current_setting('t.o2')::jsonb));
select public.t_staff(public.t_oid(current_setting('t.o2')::jsonb), 'REJECT', 'SOLD_OUT');
select is((select title like '매장 사정으로 주문이 거절되었어요. (%)' from public.notifications
  where user_id = '00000000-0000-4000-8000-0000000000e1' and dedupe_key like 'order:%:REJECTED'), true, 'rejected: one notification');
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'PAYMENT'), 2::bigint, 'the second order was paid: two PAYMENT notifications so far');
select public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = public.t_oid(current_setting('t.o2')::jsonb)), true, 'rf-n2', null);
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'PAYMENT'), 3::bigint, 'a successful refund notifies');
select is((select title from public.notifications where dedupe_key = 'payment:' || public.t_oid(current_setting('t.o2')::jsonb) || ':REFUNDED'),
  (select private.format_won(o.paid_amount) || '이 환불되었어요. (' || o.order_number || ')' from public.orders o
    where o.id = public.t_oid(current_setting('t.o2')::jsonb)), 'refund message');
select public.record_refund_result((select r.id from public.refunds r join public.payments p on p.id = r.payment_id
  where p.order_id = public.t_oid(current_setting('t.o2')::jsonb)), true, 'rf-n2', null);
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'PAYMENT'), 3::bigint, 'repeating the refund result does not notify again');

-- ===== an unpaid checkout that is cancelled shows no notification =====
select set_config('t.o3', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0))::text, true);
select t_as('00000000-0000-4000-8000-0000000000e1');
select public.customer_cancel_order(public.t_oid(current_setting('t.o3')::jsonb), 'PENDING_PAYMENT');
select t_owner();
select is((select count(*) from public.notifications where order_id = public.t_oid(current_setting('t.o3')::jsonb)), 0::bigint,
  'cancelling before payment creates no notification');

-- ===== a paid order cancelled by the customer =====
select set_config('t.o4', public.t_order('00000000-0000-4000-8000-0000000000e1', public.t_lines(1, 0))::text, true);
select public.t_pay(public.t_oid(current_setting('t.o4')::jsonb));
select t_as('00000000-0000-4000-8000-0000000000e1');
select public.customer_cancel_order(public.t_oid(current_setting('t.o4')::jsonb), 'PAID');
select t_owner();
select is((select count(*) from public.notifications where dedupe_key = 'order:' || public.t_oid(current_setting('t.o4')::jsonb) || ':CANCELLED'), 1::bigint,
  'cancelling a paid order notifies once');

-- ===== coupons and points =====
insert into public.coupons (id, title, required_stamps, valid_days, benefit_type, discount_amount)
values ('00000000-0000-4000-8000-000000000e63', 'T 정액 3000', 2, 30, 'FIXED_AMOUNT', 3000);
select private.add_stamp_tx('00000000-0000-4000-8000-0000000000e1', 'EARN', 2, 'test credit', 'tg:' || gen_random_uuid());
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'STAMP'), 2::bigint, 'a stamp credit notifies');
select private.issue_coupon_for_stamps('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000e63', gen_random_uuid());
select is((select row(title, body)::text from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'COUPON'),
  '("스탬프를 쿠폰으로 교환했어요.","T 정액 3000")', 'coupon issued: one COUPON notification naming the coupon');
insert into public.coupon_point_code_batches (id, amount, quantity, expires_at, memo)
values ('00000000-0000-4000-8000-000000000e51', 5000, 1, now() + interval '400 days', 'pgTAP');
insert into public.coupon_point_codes (id, batch_id, code, amount, expires_at)
values ('00000000-0000-4000-8000-000000000e52', '00000000-0000-4000-8000-000000000e51', 'OLIVE-NTF1-AAA1', 5000, now() + interval '90 days');
select private.register_point_code('00000000-0000-4000-8000-0000000000e1', 'OLIVE-NTF1-AAA1');
select is((select title from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'POINT'),
  '쿠폰 포인트 5,000원이 등록되었어요.', 'points registered: one POINT notification');
select private.register_point_code('00000000-0000-4000-8000-0000000000e1', 'OLIVE-NTF1-AAA1');
select private.add_point_tx('00000000-0000-4000-8000-0000000000e1', 'REGISTER', 5000, '코드 등록', 'register:00000000-0000-4000-8000-000000000e52',
  '00000000-0000-4000-8000-000000000e52');
select is(public.t_n('00000000-0000-4000-8000-0000000000e1', 'POINT'), 1::bigint, 'a repeated registration (same ledger key) does not notify again');
select is((select count(*) from public.coupon_point_transactions where user_id = '00000000-0000-4000-8000-0000000000e1'), 1::bigint, 'and wrote no second ledger row');

-- ===== preferences (OTH-05) =====
select t_as('00000000-0000-4000-8000-0000000000e2');
select is((select count(*) from public.notification_preferences), 0::bigint, 'no preference row yet: everything is on');
insert into public.notification_preferences (user_id, order_updates, notices) values ('00000000-0000-4000-8000-0000000000e2', false, true);
select throws_ok($$insert into public.notification_preferences (user_id) values ('00000000-0000-4000-8000-0000000000e3')$$, '42501', null,
  'a member cannot create preferences for someone else');
select t_owner();
select set_config('t.p2', public.t_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select public.t_pay(public.t_oid(current_setting('t.p2')::jsonb));
select public.t_staff(public.t_oid(current_setting('t.p2')::jsonb), 'ACCEPT');
select public.t_staff(public.t_oid(current_setting('t.p2')::jsonb), 'START_PREPARING');
select public.t_staff(public.t_oid(current_setting('t.p2')::jsonb), 'MARK_READY');
select public.t_staff(public.t_oid(current_setting('t.p2')::jsonb), 'COMPLETE');
select is(public.t_n('00000000-0000-4000-8000-0000000000e2'), 0::bigint, 'order updates off: no order, payment or stamp notification at all');
select is((select status::text from public.orders where id = public.t_oid(current_setting('t.p2')::jsonb)), 'COMPLETED', 'the order itself still completed');
select is((select balance from public.stamp_balances where user_id = '00000000-0000-4000-8000-0000000000e2'), 1, 'and the stamp was still earned');
select t_as('00000000-0000-4000-8000-0000000000e2');
update public.notification_preferences set order_updates = true;
select t_owner();
select public.t_staff(public.t_oid(current_setting('t.p2')::jsonb), 'COMPLETE');
select is(public.t_n('00000000-0000-4000-8000-0000000000e2'), 0::bigint, 'switching back on does not backfill earlier events');
select set_config('t.p2b', public.t_order('00000000-0000-4000-8000-0000000000e2', public.t_lines(1, 0))::text, true);
select public.t_pay(public.t_oid(current_setting('t.p2b')::jsonb));
select is(public.t_n('00000000-0000-4000-8000-0000000000e2', 'PAYMENT'), 1::bigint, 'switched on again: new events notify');

insert into public.notification_preferences (user_id, order_updates, notices) values ('00000000-0000-4000-8000-0000000000e5', true, false);

-- ===== announcements: published vs unpublished visibility =====
select t_as('00000000-0000-4000-8000-0000000000a1');
insert into public.announcements (id, title, body, status) values
  ('00000000-0000-4000-8000-000000000e71', 'T 공개 공지', '본문', 'PUBLISHED'),
  ('00000000-0000-4000-8000-000000000e72', 'T 비공개 공지', '본문', 'UNPUBLISHED');
select is((select row(status, published_at is not null, created_by)::text from public.announcements where id = '00000000-0000-4000-8000-000000000e71'),
  '(PUBLISHED,t,00000000-0000-4000-8000-0000000000a1)', 'admin: publishing stamps published_at, the server stamps created_by');
select is((select published_at from public.announcements where id = '00000000-0000-4000-8000-000000000e72'), null::timestamptz, 'a draft has no published_at');
select throws_ok($$update public.announcements set published_at = now() where id = '00000000-0000-4000-8000-000000000e72'$$, '42501', null,
  'admin: published_at cannot be written directly');
select throws_ok($$insert into public.announcements (title, body, status) values (repeat('가', 61), 'b', 'PUBLISHED')$$, '23514', null,
  'a title over 60 characters is rejected');
select throws_ok($$insert into public.announcements (title, body, status) values ('t', '', 'PUBLISHED')$$, '23514', null, 'an empty body is rejected');
select is((select count(*) from public.announcements where id in ('00000000-0000-4000-8000-000000000e71', '00000000-0000-4000-8000-000000000e72')), 2::bigint,
  'admin sees both published and unpublished');
select t_as('00000000-0000-4000-8000-0000000000e3');
select is((select array_agg(title) from public.announcements where id in ('00000000-0000-4000-8000-000000000e71', '00000000-0000-4000-8000-000000000e72')),
  array['T 공개 공지'], 'customer: only the published announcement');
select throws_ok($$insert into public.announcements (title, body, status) values ('t', 'b', 'PUBLISHED')$$, '42501', null, 'customer: cannot create');
select is(public.t_rows($q$update public.announcements set title = 'hacked'$q$), 0::bigint, 'customer: cannot update (no row reachable)');
select is(public.t_rows($q$delete from public.announcements$q$), 0::bigint, 'customer: cannot delete');
select t_as('00000000-0000-4000-8000-0000000000b1');
select is((select count(*) from public.announcements where id in ('00000000-0000-4000-8000-000000000e71', '00000000-0000-4000-8000-000000000e72')), 1::bigint,
  'staff (all permissions): published only');
select throws_ok($$insert into public.announcements (title, body, status) values ('t', 'b', 'PUBLISHED')$$, '42501', null, 'staff: cannot create');
select t_anon();
select throws_ok($$select * from public.announcements$$, '42501', null, 'anon: no announcements');
select t_owner();

-- Publishing notified the members with notices on, once.
select is((select count(*) from public.notifications where dedupe_key = 'notice:00000000-0000-4000-8000-000000000e71:00000000-0000-4000-8000-0000000000e3'), 1::bigint,
  'a member with default preferences got the notice');
select is((select kind::text from public.notifications where dedupe_key = 'notice:00000000-0000-4000-8000-000000000e71:00000000-0000-4000-8000-0000000000e3'),
  'NOTICE', 'as a NOTICE');
select is((select count(*) from public.notifications where dedupe_key like 'notice:00000000-0000-4000-8000-000000000e71:%' and user_id = '00000000-0000-4000-8000-0000000000e5'),
  0::bigint, 'notices off: no notification');
select is((select count(*) from public.notifications where dedupe_key like 'notice:00000000-0000-4000-8000-000000000e71:%' and user_id = '00000000-0000-4000-8000-0000000000b1'),
  0::bigint, 'staff accounts are not notified');
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e2' and kind = 'NOTICE'), 1::bigint,
  'order updates off does not switch notices off');
select is((select count(*) from public.notifications where dedupe_key like 'notice:00000000-0000-4000-8000-000000000e72:%'), 0::bigint, 'a draft notifies nobody');

select t_as('00000000-0000-4000-8000-0000000000a1');
update public.announcements set status = 'PUBLISHED' where id = '00000000-0000-4000-8000-000000000e72';
select is((select published_at is not null from public.announcements where id = '00000000-0000-4000-8000-000000000e72'), true, 'publishing a draft stamps published_at');
update public.announcements set status = 'UNPUBLISHED' where id = '00000000-0000-4000-8000-000000000e72';
select is((select published_at from public.announcements where id = '00000000-0000-4000-8000-000000000e72'), null::timestamptz, 'unpublishing clears it');
select t_as('00000000-0000-4000-8000-0000000000e3');
select is((select count(*) from public.announcements where id = '00000000-0000-4000-8000-000000000e72'), 0::bigint, 'and hides it from customers again');
select t_as('00000000-0000-4000-8000-0000000000a1');
update public.announcements set status = 'PUBLISHED' where id = '00000000-0000-4000-8000-000000000e72';
select t_owner();
select is((select count(*) from public.notifications where dedupe_key = 'notice:00000000-0000-4000-8000-000000000e72:00000000-0000-4000-8000-0000000000e3'), 1::bigint,
  'publishing, unpublishing and publishing again notifies once');
select is((select count(*) from public.admin_audit_log where entity = 'announcements' and entity_id = '00000000-0000-4000-8000-000000000e72'), 4::bigint,
  'every announcement change is in the audit log');
select t_as('00000000-0000-4000-8000-0000000000a1');
select is(public.t_rows($q$delete from public.announcements where id = '00000000-0000-4000-8000-000000000e72'$q$), 1::bigint,
  'admin can delete an announcement');
select t_owner();

-- ===== visibility and writes =====
select t_as('00000000-0000-4000-8000-0000000000e1');
select is((select count(*) from public.notifications where user_id <> '00000000-0000-4000-8000-0000000000e1'), 0::bigint, 'customer: sees only their own notifications');
select cmp_ok((select count(*) from public.notifications), '>', 8::bigint, 'and does see their own');
select throws_ok($$insert into public.notifications (user_id, kind, title, dedupe_key) values ('00000000-0000-4000-8000-0000000000e1', 'ORDER', 'forged', 'forged:1')$$,
  '42501', null, 'customer: cannot create a notification');
select throws_ok($$update public.notifications set title = 'x'$$, '42501', null, 'customer: cannot rewrite a title');
select throws_ok($$update public.notifications set user_id = '00000000-0000-4000-8000-0000000000e2'$$, '42501', null, 'customer: cannot hand one to someone else');
select throws_ok($$delete from public.notifications$$, '42501', null, 'customer: cannot delete a notification');
select set_config('t.stampn', (select id::text from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'STAMP' limit 1), true);
select t_as('00000000-0000-4000-8000-0000000000e6');
select is((select count(*) from public.notifications where user_id <> '00000000-0000-4000-8000-0000000000e6'), 0::bigint, 'another customer: sees none of them');
select is((select array_agg(distinct kind::text) from public.notifications), array['NOTICE'], 'and only their own notices');
select is(public.t_rows($q$update public.notifications set is_read = true where user_id = '00000000-0000-4000-8000-0000000000e1'$q$), 0::bigint,
  'another customer: cannot mark them read');
select is(public.mark_notifications_read(array[current_setting('t.stampn')::uuid])::text, '{"updated": 0}', 'and not through the RPC either');
select t_as('00000000-0000-4000-8000-0000000000b1');
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1'), 0::bigint, 'staff: cannot read a customer''s notifications');
select t_as('00000000-0000-4000-8000-0000000000a1');
select is((select count(*) from public.notifications where user_id = '00000000-0000-4000-8000-0000000000e1'), 0::bigint, 'admin: neither');
select t_anon();
select throws_ok($$select * from public.notifications$$, '42501', null, 'anon: no notifications');
select throws_ok($$select * from public.notification_preferences$$, '42501', null, 'anon: no preferences');
select throws_ok($$select public.mark_notifications_read(null)$$, '42501', null, 'anon: cannot call mark read');
select t_as('00000000-0000-4000-8000-0000000000e1');
select throws_ok($$select private.notify(null, 'ORDER', 'x', '', null, 'k')$$, '42501', null, 'customer: cannot call the internal writer');
select is(public.t_rows($q$update public.notifications set is_read = true where kind = 'POINT'$q$), 1::bigint, 'customer: can mark their own as read');
select is((select unread from (select count(*) filter (where not is_read) unread from public.notifications) x), (select count(*) from public.notifications) - 1,
  'one fewer unread');
select is(public.mark_notifications_read(array[current_setting('t.stampn')::uuid])::text, '{"updated": 1}', 'mark one through the RPC');
select is(public.mark_notifications_read(array[current_setting('t.stampn')::uuid])::text, '{"updated": 0}', 'marking it again changes nothing');
select is((select count(*) from public.notifications where not is_read)::int, (public.mark_notifications_read(null) ->> 'updated')::int,
  'mark all returns how many were unread');
select is((select count(*) from public.notifications where not is_read), 0::bigint, 'and nothing is unread afterwards');
select t_owner();

-- ===== realtime hint =====
select cmp_ok((select count(*) from realtime.messages where topic = 'user:00000000-0000-4000-8000-0000000000e1' and event = 'notification_created'),
  '>=', 8::bigint, 'each notification sends notification_created to the owner');
select is((select array(select k from jsonb_object_keys(payload) k order by k) from realtime.messages
  where topic = 'user:00000000-0000-4000-8000-0000000000e1' and event = 'notification_created' limit 1), array['id', 'kind'], 'the hint carries only the id and kind');
select is((select count(*) from realtime.messages where topic = 'user:00000000-0000-4000-8000-0000000000e6' and event = 'notification_created' and payload ->> 'kind' <> 'NOTICE'), 0::bigint,
  'nothing but the notices is sent to a member without activity');

-- ===== reward summary (HOME-04) =====
update public.coupons set is_active = false;
insert into public.coupons (id, title, required_stamps, valid_days, benefit_type, discount_amount) values
  ('00000000-0000-4000-8000-000000000e64', 'T 3', 3, 30, 'FIXED_AMOUNT', 1000),
  ('00000000-0000-4000-8000-000000000e65', 'T 5', 5, 30, 'FIXED_AMOUNT', 2000);
select t_as('00000000-0000-4000-8000-0000000000e4');
select is(public.get_my_reward_summary()::text,
  '{"points": {"balance": 0, "available": 0}, "stamps": {"balance": 0, "nextGoal": 3}, "availableCouponCount": 0}', 'a new member: zeros, goal = smallest requirement');
select t_owner();
select private.add_stamp_tx('00000000-0000-4000-8000-0000000000e4', 'EARN', 4, 'c', 'sum:1');
select t_as('00000000-0000-4000-8000-0000000000e4');
select is(public.get_my_reward_summary() #>> '{stamps,nextGoal}', '5', 'with 4 stamps the next goal is 5');
select t_owner();
select private.add_stamp_tx('00000000-0000-4000-8000-0000000000e4', 'EARN', 3, 'c', 'sum:2');
select t_as('00000000-0000-4000-8000-0000000000e4');
select is(public.get_my_reward_summary() #>> '{stamps,nextGoal}', '5', 'above every requirement the goal stays the largest');
select is(public.get_my_reward_summary() #>> '{stamps,balance}', '7', 'stamp balance');
select t_owner();
insert into public.coupon_point_codes (id, batch_id, code, amount, expires_at)
values ('00000000-0000-4000-8000-000000000e53', '00000000-0000-4000-8000-000000000e51', 'OLIVE-NTF1-AAA2', 3000, now() + interval '90 days');
select private.register_point_code('00000000-0000-4000-8000-0000000000e4', 'OLIVE-NTF1-AAA2');
select private.issue_coupon_for_stamps('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-000000000e64', gen_random_uuid());
select t_as('00000000-0000-4000-8000-0000000000e4');
select is(public.get_my_reward_summary()::text,
  '{"points": {"balance": 3000, "available": 3000}, "stamps": {"balance": 4, "nextGoal": 5}, "availableCouponCount": 1}',
  'stamps, points and the coupon count are separate fields of one summary');
select t_as('00000000-0000-4000-8000-0000000000e6');
select is(public.get_my_reward_summary() #>> '{stamps,balance}', '0', 'another member sees only their own summary');
select t_anon();
select throws_ok($$select public.get_my_reward_summary()$$, '42501', null, 'anon: no summary');
select t_owner();

select * from finish();
rollback;
