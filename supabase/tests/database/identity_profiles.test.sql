-- Phase (a) RLS: profiles. Roles: anon, customer, staff, admin. Requirement: AUTH-01..AUTH-03.
begin;
select plan(16);

-- anon: no access at all (table privileges revoked).
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$update public.profiles set nickname = 'x'$$, '42501', null, 'anon cannot update profiles');
reset role;

-- customer1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.profiles), 1::bigint, 'customer reads only their own profile');
select is((select nickname from public.profiles), '고객하나', 'own nickname comes from provider metadata');
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-0000000000c2'),
  0::bigint, 'customer cannot read another customer profile');
select lives_ok($$update public.profiles set nickname = '새닉네임' where id = '00000000-0000-4000-8000-0000000000c1'$$,
  'customer can update own nickname');
select throws_ok($$update public.profiles set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000c1'$$,
  '42501', null, 'customer cannot write deleted_at');
select throws_ok($$update public.profiles set username = 'hacker' where id = '00000000-0000-4000-8000-0000000000c1'$$,
  '42501', null, 'customer cannot write username');
update public.profiles set nickname = 'hijack' where id = '00000000-0000-4000-8000-0000000000c2';
select is(
  (select count(*) from public.profiles where nickname = 'hijack'),
  0::bigint, 'customer update of another profile has no effect');
select throws_ok($$update public.profiles set nickname = repeat('가', 21) where id = '00000000-0000-4000-8000-0000000000c1'$$,
  '23514', null, 'nickname longer than 20 characters is rejected');
select throws_ok($$insert into public.profiles (id) values (gen_random_uuid())$$, '42501', null,
  'customer cannot insert profiles');
select throws_ok($$delete from public.profiles$$, '42501', null, 'customer cannot delete profiles');
reset role;

-- admin does not read other profiles through the table (member data goes through masked admin_* RPCs).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.profiles), 1::bigint, 'admin reads only their own profile row');
reset role;

-- staff likewise.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.profiles), 1::bigint, 'staff reads only their own profile row');
reset role;

-- handle_new_user: nickname from metadata, truncated to 20, default when absent.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kakao@example.test', '{"nickname":"카카오닉네임이아주아주아주아주길어요길어요"}'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'apple@example.test', '{}');
select is((select char_length(nickname) from public.profiles where id = '00000000-0000-4000-8000-0000000000d1'),
  20, 'long provider nickname is truncated to 20 characters');
select is((select nickname from public.profiles where id = '00000000-0000-4000-8000-0000000000d2'),
  '올리브 회원', 'default nickname when the provider sends none');

select * from finish();
rollback;
