-- Phase (a): service-role staff creation, operator bootstrap, append-only audit log, masking vectors.
begin;
select plan(15);

-- admin-staff Edge Function path (service role after it verified the caller is an admin).
set local role service_role;
select lives_ok($$select * from public.admin_create_staff_record(
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c2', 'STAFF', '{PROCESS_ORDERS}', '신입')$$,
  'service role creates a staff record on behalf of an admin');
select throws_ok($$select * from public.admin_create_staff_record(
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c2', 'STAFF', '{PROCESS_ORDERS}', '신입')$$,
  'P0001', 'ALREADY_STAFF', 'creating the same staff twice is rejected');
select throws_ok($$select * from public.admin_create_staff_record(
  '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', 'STAFF', '{PROCESS_ORDERS}', 'x')$$,
  'P0001', 'FORBIDDEN', 'a non-admin actor cannot create staff even via the service role');
reset role;

select is((select actor_id from public.admin_audit_log
  where entity = 'staff_members' and entity_id = '00000000-0000-4000-8000-0000000000c2' and action = 'INSERT'),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'service-role insert is audited with the admin actor');

-- Audit log is append-only for everyone, including the table owner.
select throws_ok($$update public.admin_audit_log set entity = 'tampered'$$, 'P0001', 'APPEND_ONLY',
  'audit log update is blocked');
select throws_ok($$delete from public.admin_audit_log$$, 'P0001', 'APPEND_ONLY', 'audit log delete is blocked');

-- Operator bootstrap.
select throws_ok($$select private.bootstrap_admin('customer1@theolive.local')$$, 'P0001', 'ADMIN_EXISTS',
  'bootstrap refuses while an active admin exists');
delete from public.staff_members where role = 'ADMIN';
select throws_ok($$select private.bootstrap_admin('nobody@theolive.local')$$, 'P0001', 'NOT_FOUND',
  'bootstrap needs an existing auth user');
select is((select (private.bootstrap_admin('Customer1@Theolive.local')).role::text), 'ADMIN',
  'bootstrap promotes an existing user (case-insensitive email)');
select throws_ok($$select private.bootstrap_admin('customer2@theolive.local')$$, 'P0001', 'ADMIN_EXISTS',
  'bootstrap runs only once');

-- Masking vectors shared with apps/store/src/domain/masking.test.ts.
select is(private.mask_email('honggildong@gmail.com'), 'hong***@gmail.com', 'mask_email long local part');
select is(private.mask_email('abcd@naver.com'), 'a***@naver.com', 'mask_email short local part');
select is(private.mask_email('not-an-email'), '***', 'mask_email malformed');
select is(private.mask_phone('+82 10 1234 5678'), '010-****-5678', 'mask_phone Korean mobile');
select is(private.mask_phone('+1 415 555 2671'), '***-2671', 'mask_phone foreign number');

select * from finish();
rollback;
