-- LOCAL DEVELOPMENT SEED ONLY. Never run against a remote project.
-- Phase (a): auth users (email/password), their profiles (via the handle_new_user trigger) and staff rows.
-- All accounts share one documented local test password: olive-local-1234
-- Deterministic uuids so tests and docs can refer to them.

create function pg_temp.seed_user(p_id uuid, p_email text, p_nickname text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('olive-local-1234', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nickname', p_nickname),
    now(), now(), '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text, 'email',
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );
end;
$$;

select pg_temp.seed_user('00000000-0000-4000-8000-0000000000a1', 'admin@theolive.local', '김올리');
select pg_temp.seed_user('00000000-0000-4000-8000-0000000000b1', 'staff@theolive.local', '이직원');
select pg_temp.seed_user('00000000-0000-4000-8000-0000000000b2', 'barista@theolive.local', '박바리');
select pg_temp.seed_user('00000000-0000-4000-8000-0000000000b3', 'inactive@theolive.local', '최퇴사');
select pg_temp.seed_user('00000000-0000-4000-8000-0000000000c1', 'customer1@theolive.local', '고객하나');
select pg_temp.seed_user('00000000-0000-4000-8000-0000000000c2', 'customer2@theolive.local', '고객둘');

insert into public.staff_members (user_id, role, permissions, display_name, is_active) values
  ('00000000-0000-4000-8000-0000000000a1', 'ADMIN', '{PROCESS_ORDERS,MANAGE_OPERATIONS}', '김올리', true),
  ('00000000-0000-4000-8000-0000000000b1', 'STAFF', '{PROCESS_ORDERS,MANAGE_OPERATIONS}', '이직원', true),
  ('00000000-0000-4000-8000-0000000000b2', 'STAFF', '{PROCESS_ORDERS}', '박바리', true),
  ('00000000-0000-4000-8000-0000000000b3', 'STAFF', '{PROCESS_ORDERS}', '최퇴사', false);

-- Phase (b): store settings, business hours, menu (from the app fixtures so screens look the same).
-- Deterministic ids: categories ...0000000001NN, items ...0000000002NN.
update public.store_settings set
  name = '더 올리브 카페',
  phone = '02-123-4567',
  address = '서울특별시 마포구 월드컵로 12길 7, 1층',
  description = '교회 옆 작은 카페, 올리브나무 아래에서 따뜻한 한 잔을 만나보세요.',
  is_open = true,
  is_accepting_orders = true,
  pending_payment_ttl_minutes = 15,
  new_order_sound = true,
  new_order_banner = true,
  sold_out_reminder = false,
  daily_summary = true
where id = 1;

update public.business_hours set
  is_closed = (weekday = 6),
  opens_at = (case when weekday = 5 then '10:00' else '08:00' end)::time,
  closes_at = (case when weekday = 5 then '20:00' else '21:00' end)::time;

insert into public.menu_categories (id, name, sort_order) values
  ('00000000-0000-4000-8000-000000000101', '커피', 1),
  ('00000000-0000-4000-8000-000000000102', '라떼', 2),
  ('00000000-0000-4000-8000-000000000103', '논커피', 3),
  ('00000000-0000-4000-8000-000000000104', '티', 4),
  ('00000000-0000-4000-8000-000000000105', '디저트', 5);

insert into public.menu_items
  (id, category_id, name, description, price, temperatures, is_sold_out, sort_order) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', '아메리카노',
   '진한 에스프레소에 물을 더한 깊은 풍미의 커피', 4500, '{HOT,ICE}', false, 1),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', '콜드브루',
   '저온에서 오래 우려낸 부드러운 커피', 5000, '{ICE}', false, 2),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000102', '카페 라떼',
   '에스프레소와 스팀 우유의 부드러운 조화', 5000, '{HOT,ICE}', false, 1),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000102', '바닐라 라떼',
   '바닐라 시럽을 더한 달콤한 라떼', 5500, '{HOT,ICE}', true, 2),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000102', '카푸치노',
   '풍성한 우유 거품을 올린 진한 커피', 5000, '{HOT}', false, 3),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000103', '초코 우유',
   '진한 초콜릿을 부드러운 우유에 더했어요', 5200, '{HOT,ICE}', false, 1),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000104', '그린티',
   '은은한 향의 따뜻한 녹차', 4800, '{HOT}', false, 1),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000104', '유자차',
   '달콤새콤한 유자청으로 만든 차', 5000, '{HOT,ICE}', false, 2),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000105', '플레인 스콘',
   '겉은 바삭하고 속은 촉촉한 스콘', 3800, '{HOT,ICE}', false, 1);

-- Phase (c): where the pg_cron reconcile job calls the payments-reconcile Edge Function (local stack only).
-- The key below is the well-known local-development service role JWT printed by `supabase status`; it is not a secret.
select vault.create_secret('http://kong:8000/functions/v1', 'functions_base_url', 'Edge Functions base URL for pg_net');
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'service_role_key', 'Local service role key for pg_net');

-- Phase (d): coupon exchange rules (from the store fixture) and customer1's stamps and coupon.
-- The default stamp policy (1 stamp per order, earned at COMPLETED) comes from the migration.
-- "아메리카노 또는 라떼" = those two items; "전체 음료" = every category except desserts.
insert into public.coupons
  (id, title, required_stamps, valid_days, benefit_type, discount_amount,
   eligible_category_ids, eligible_menu_item_ids, sort_order) values
  ('00000000-0000-4000-8000-000000000301', '아메리카노 또는 라떼 쿠폰', 10, 90, 'FREE_ITEM', null, '{}',
   '{00000000-0000-4000-8000-000000000201,00000000-0000-4000-8000-000000000203}', 1),
  ('00000000-0000-4000-8000-000000000302', '전체 음료 쿠폰', 15, 90, 'FREE_ITEM', null,
   '{00000000-0000-4000-8000-000000000101,00000000-0000-4000-8000-000000000102,00000000-0000-4000-8000-000000000103,00000000-0000-4000-8000-000000000104}',
   '{}', 2);

-- customer1: 17 stamps earned, 10 exchanged through the real exchange function = 7 stamps and 1 coupon.
-- customer2 stays empty (empty states).
do $$
declare
  i integer;
begin
  for i in 1..17 loop
    perform private.add_stamp_tx(
      '00000000-0000-4000-8000-0000000000c1', 'EARN', 1, '주문 적립', 'seed:earn:' || i);
  end loop;
  perform private.issue_coupon_for_stamps(
    '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000a01');
end;
$$;

-- Phase (e): Coupon Points. Codes are inserted directly (the admin RPC needs an admin session) with fixed values so
-- they can be typed by hand; the points of customer1 are registered through the same function the app calls, so the
-- ledger is consistent. Unregistered test codes for manual testing (type them in Reward > 쿠폰 포인트 코드):
--   OLIVE-TEST-5000 (5,000 won), OLIVE-TEST-3000 (3,000), OLIVE-TEST-1000 (1,000),
--   OLIVE-OLD0-0001 (expired), OLIVE-VOID-0001 (voided), OLIVE-USED-0001 (already registered by the admin account).
insert into public.coupon_point_code_batches (id, amount, quantity, expires_at, memo) values
  ('00000000-0000-4000-8000-000000000401', 5000, 3, now() + interval '180 days', '로컬 테스트 코드'),
  ('00000000-0000-4000-8000-000000000402', 10000, 2, now() + interval '90 days', '환영 선물'),
  ('00000000-0000-4000-8000-000000000403', 2000, 3, now() - interval '1 day', '만료/무효/사용 테스트');

insert into public.coupon_point_codes (id, batch_id, code, amount, expires_at, status) values
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000401', 'OLIVE-TEST-5000', 5000,
   now() + interval '180 days', 'UNUSED'),
  ('00000000-0000-4000-8000-000000000412', '00000000-0000-4000-8000-000000000401', 'OLIVE-TEST-3000', 3000,
   now() + interval '180 days', 'UNUSED'),
  ('00000000-0000-4000-8000-000000000413', '00000000-0000-4000-8000-000000000401', 'OLIVE-TEST-1000', 1000,
   now() + interval '180 days', 'UNUSED'),
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000402', 'OLIVE-WELC-0001', 10000,
   now() + interval '90 days', 'UNUSED'),
  ('00000000-0000-4000-8000-000000000422', '00000000-0000-4000-8000-000000000402', 'OLIVE-WELC-0002', 2000,
   now() + interval '60 days', 'UNUSED'),
  ('00000000-0000-4000-8000-000000000431', '00000000-0000-4000-8000-000000000403', 'OLIVE-OLD0-0001', 2000,
   now() - interval '1 day', 'UNUSED'),
  ('00000000-0000-4000-8000-000000000432', '00000000-0000-4000-8000-000000000403', 'OLIVE-VOID-0001', 2000,
   now() + interval '30 days', 'UNUSED'),
  ('00000000-0000-4000-8000-000000000433', '00000000-0000-4000-8000-000000000403', 'OLIVE-USED-0001', 2000,
   now() + interval '30 days', 'UNUSED');
update public.coupon_point_codes set status = 'VOID', voided_at = now()
 where code = 'OLIVE-VOID-0001';

-- customer1: 12,000 won (10,000 + 2,000, two lots). customer2 stays empty; OLIVE-USED-0001 is registered by the admin.
select private.register_point_code('00000000-0000-4000-8000-0000000000c1', 'OLIVE-WELC-0001');
select private.register_point_code('00000000-0000-4000-8000-0000000000c1', 'OLIVE-WELC-0002');
select private.register_point_code('00000000-0000-4000-8000-0000000000a1', 'OLIVE-USED-0001');
-- The seed registrations are not user mistakes; keep the attempt log empty for the manual tests.
delete from public.coupon_point_code_attempts;

-- Phase (f): announcements (from the store fixture; two published, one unpublished). Publishing notifies the
-- members, so customers see the notices in their notification list.
insert into public.announcements (id, title, body, status) values
  ('00000000-0000-4000-8000-000000000501', '추석 연휴 영업 시간 안내',
   '연휴 기간에는 오전 10시부터 오후 6시까지 운영합니다.', 'PUBLISHED'),
  ('00000000-0000-4000-8000-000000000502', '신메뉴 출시: 유자차',
   '달콤새콤한 유자차가 새로 나왔어요. HOT / ICE 모두 가능합니다.', 'PUBLISHED'),
  ('00000000-0000-4000-8000-000000000503', '11월 올리브 스탬프 이벤트 (준비 중)',
   '이벤트 내용은 확정 후 게시합니다.', 'UNPUBLISHED');

-- The seed earns its stamps through many orders; keep only the newest two stamp notifications per member so the
-- notification list is not a wall of identical rows. (Balances and ledgers are untouched.)
delete from public.notifications n using (
  select id, row_number() over (partition by user_id order by created_at desc, id) as rn
    from public.notifications where kind = 'STAMP'
) old where n.id = old.id and old.rn > 2;
