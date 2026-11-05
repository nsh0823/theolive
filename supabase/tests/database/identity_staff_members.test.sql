-- Phase (a) RLS and RPCs: staff_members, role helpers, admin staff management, audit log.
-- Requirement: plan section 2 / 7 / 11.1 (roles, immediate deactivation, last admin).
begin;
select plan(46);

-- ===== anon =====
set local role anon;
select throws_ok($$select * from public.staff_members$$, '42501', null, 'anon cannot read staff_members');
select throws_ok($$select * from public.admin_audit_log$$, '42501', null, 'anon cannot read admin_audit_log');
select throws_ok($$select * from public.get_my_staff_role()$$, '42501', null, 'anon cannot call get_my_staff_role');
select throws_ok($$select * from public.admin_list_staff()$$, '42501', null, 'anon cannot call admin_list_staff');
select throws_ok($$select private.is_admin()$$, '42501', null, 'anon cannot call role helpers');
reset role;

-- ===== customer1 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.staff_members), 0::bigint, 'customer sees no staff rows');
select is((select count(*) from public.admin_audit_log), 0::bigint, 'customer sees no audit rows');
select is((select count(*) from public.get_my_staff_role()), 0::bigint, 'customer has no staff role');
select is((select private.is_admin()), false, 'customer is not admin');
select is((select private.is_active_staff()), false, 'customer is not staff');
select is((select private.has_staff_permission('PROCESS_ORDERS')), false, 'customer has no staff permission');
select throws_ok($$select private.current_actor_role()$$, '42501', null,
  'private helpers that no policy uses are not callable by clients (current_actor_role)');
select throws_ok($$insert into public.staff_members (user_id, role, display_name)
  values ('00000000-0000-4000-8000-0000000000c1', 'ADMIN', 'self-promote')$$, '42501', null,
  'customer cannot insert a staff row (self-promotion)');
select throws_ok($$update public.staff_members set role = 'ADMIN'$$, '42501', null, 'customer cannot update staff rows');
select throws_ok($$delete from public.staff_members$$, '42501', null, 'customer cannot delete staff rows');
select throws_ok($$insert into public.admin_audit_log (entity, entity_id, action) values ('x','1','INSERT')$$,
  '42501', null, 'customer cannot write the audit log');
select throws_ok($$select * from public.admin_list_staff()$$, 'P0001', 'FORBIDDEN', 'customer cannot list staff');
select throws_ok($$select * from public.admin_update_staff(
  '00000000-0000-4000-8000-0000000000b2', 'ADMIN', '{PROCESS_ORDERS}', 'x', true)$$,
  'P0001', 'FORBIDDEN', 'customer cannot update staff');
select throws_ok($$select * from public.admin_create_staff_record(
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'STAFF', '{PROCESS_ORDERS}', 'x')$$,
  '42501', null, 'customer cannot call the service-role staff creator');
select throws_ok($$select private.bootstrap_admin('customer1@theolive.local')$$, '42501', null,
  'customer cannot bootstrap an admin');
reset role;

-- ===== staff (both permissions) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.staff_members), 1::bigint, 'staff sees only their own staff row');
select is((select role::text from public.get_my_staff_role()), 'STAFF', 'staff role');
select is((select private.is_admin()), false, 'staff is not admin');
select is((select private.has_staff_permission('MANAGE_OPERATIONS')), true, 'staff with MANAGE_OPERATIONS');
select is((select count(*) from public.admin_audit_log), 0::bigint, 'staff cannot read the audit log');
select throws_ok($$select * from public.admin_list_staff()$$, 'P0001', 'FORBIDDEN', 'staff cannot list staff');
select throws_ok($$select * from public.admin_update_staff(
  '00000000-0000-4000-8000-0000000000b1', 'ADMIN', '{PROCESS_ORDERS}', 'x', true)$$,
  'P0001', 'FORBIDDEN', 'staff cannot promote self through the RPC');
reset role;

-- ===== barista (PROCESS_ORDERS only) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select is((select private.has_staff_permission('PROCESS_ORDERS')), true, 'barista may process orders');
select is((select private.has_staff_permission('MANAGE_OPERATIONS')), false, 'barista may not manage operations');
select throws_ok($$select private.current_actor_role()$$, '42501', null,
  'staff cannot call current_actor_role directly either (actor roles are covered by the order history tests)');
reset role;

-- ===== inactive staff =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;
select is((select private.is_active_staff()), false, 'inactive staff is not active staff');
select is((select private.has_staff_permission('PROCESS_ORDERS')), false, 'inactive staff has no permission');
select is((select is_active from public.get_my_staff_role()), false, 'inactive staff reads own row flagged inactive');
reset role;

-- ===== admin =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.staff_members), 4::bigint, 'admin reads all staff rows');
select is((select private.is_admin()), true, 'admin helper');
select is((select count(*) from public.admin_list_staff()), 4::bigint, 'admin lists staff with email');
select is((select email from public.admin_list_staff() where display_name = '박바리'), 'barista@theolive.local',
  'staff email comes from auth.users');
select throws_ok($$insert into public.staff_members (user_id, role, display_name)
  values ('00000000-0000-4000-8000-0000000000c1', 'STAFF', 'direct')$$, '42501', null,
  'even admin cannot write staff_members directly');
select throws_ok($$insert into public.admin_audit_log (entity, entity_id, action) values ('x','1','INSERT')$$,
  '42501', null, 'even admin cannot write the audit log');
select throws_ok($$select * from public.admin_update_staff(
  '00000000-0000-4000-8000-0000000000a1', 'STAFF', '{PROCESS_ORDERS}', '김올리', true)$$,
  'P0001', 'CANNOT_CHANGE_SELF_ROLE', 'admin cannot change own role');
select throws_ok($$select * from public.admin_update_staff(
  '00000000-0000-4000-8000-0000000000a1', 'ADMIN', '{PROCESS_ORDERS}', '김올리', false)$$,
  'P0001', 'LAST_ADMIN', 'last active admin cannot be deactivated');
select throws_ok($$select * from public.admin_update_staff(
  '00000000-0000-4000-8000-0000000000ff', 'STAFF', '{PROCESS_ORDERS}', 'x', true)$$,
  'P0001', 'NOT_FOUND', 'unknown staff user');
select throws_ok($$select * from public.admin_update_staff(
  '00000000-0000-4000-8000-0000000000b2', 'STAFF', '{PROCESS_ORDERS}', '', true)$$,
  'P0001', 'INVALID_INPUT', 'empty display name is invalid');

-- Deactivation is immediate: the same barista session loses access on the next statement.
select lives_ok($$select * from public.admin_update_staff(
  '00000000-0000-4000-8000-0000000000b2', 'STAFF', '{PROCESS_ORDERS,MANAGE_OPERATIONS}', '박바리', false)$$,
  'admin deactivates barista and changes permissions');
select is((select count(*) from public.admin_audit_log where entity = 'staff_members'
  and entity_id = '00000000-0000-4000-8000-0000000000b2' and actor_id = '00000000-0000-4000-8000-0000000000a1'),
  1::bigint, 'staff change is audited with the admin as actor');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select is((select private.has_staff_permission('PROCESS_ORDERS')), false, 'deactivated staff loses permission immediately');
reset role;

select * from finish();
rollback;
