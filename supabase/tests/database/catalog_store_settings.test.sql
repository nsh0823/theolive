-- Phase (b) RLS and RPCs: store_settings and business_hours (plan sections 2 and 11.1).
-- Requirement: SW-08, SA-05, SA-11. Roles: anon, customer, staff with and without MANAGE_OPERATIONS, inactive staff, admin.
begin;

-- Audit baselines: committed audit rows from other suites (API integration tests) must not change the result,
-- so the assertions below compare against counts taken here.
select set_config('t.audit_ss_b1', (select count(*) from public.admin_audit_log where entity = 'store_settings'
  and actor_id = '00000000-0000-4000-8000-0000000000b1')::text, true);
select set_config('t.audit_bh_a1', (select count(*) from public.admin_audit_log where entity = 'business_hours'
  and actor_id = '00000000-0000-4000-8000-0000000000a1')::text, true);
select set_config('t.audit_ss_all', (select count(*) from public.admin_audit_log where entity = 'store_settings')::text, true);

-- Rolled back with the transaction. Runs a statement as the current role and reports how many rows it touched,
-- because RLS filters writes silently (0 rows) instead of raising.
create function public.test_rows_affected(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.test_rows_affected(text) to anon, authenticated;
select plan(32);

-- ===== anon =====
set local role anon;
select throws_ok($$select * from public.store_settings$$, '42501', null, 'anon cannot read store_settings');
select throws_ok($$select * from public.business_hours$$, '42501', null, 'anon cannot read business_hours');
select throws_ok($$select * from public.set_store_status(false, false)$$, '42501', null, 'anon cannot call set_store_status');
reset role;

-- ===== customer1 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.store_settings), 1::bigint, 'customer reads the single store_settings row');
select is((select count(*) from public.business_hours), 7::bigint, 'customer reads all 7 business_hours rows');
select throws_ok($$select * from public.set_store_status(false, false)$$, 'P0001', 'FORBIDDEN',
  'customer cannot change store status');
select is(public.test_rows_affected($q$update public.store_settings set name = 'hacked'$q$),
  0::bigint, 'customer update of store_settings affects no rows');
select throws_ok($$update public.store_settings set is_open = false$$, '42501', null,
  'customer has no column grant on is_open');
select is(public.test_rows_affected($q$update public.business_hours set is_closed = true$q$),
  0::bigint, 'customer cannot update business_hours');
select throws_ok($$insert into public.store_settings (id, name) values (2, 'second')$$, '42501', null,
  'customer cannot insert a second store');
select throws_ok($$delete from public.store_settings$$, '42501', null, 'nobody can delete store_settings');
reset role;

-- ===== barista (PROCESS_ORDERS only) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.set_store_status(false, false)$$, 'P0001', 'FORBIDDEN',
  'staff without MANAGE_OPERATIONS cannot change store status');
select is(public.test_rows_affected($q$update public.store_settings set name = 'hacked'$q$),
  0::bigint, 'staff without MANAGE_OPERATIONS cannot edit store info');
reset role;

-- ===== inactive staff =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.set_store_status(false, false)$$, 'P0001', 'FORBIDDEN',
  'inactive staff cannot change store status');
reset role;

-- ===== staff with MANAGE_OPERATIONS =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select is((select is_open from public.set_store_status(false, null)), false, 'staff closes the store');
select is((select is_accepting_orders from public.store_settings), true, 'a null argument leaves the other switch unchanged');
select is((select is_accepting_orders from public.set_store_status(null, false)), false, 'staff pauses order acceptance');
select is((select updated_by from public.store_settings), '00000000-0000-4000-8000-0000000000b1'::uuid,
  'updated_by records the staff member');
select is(public.test_rows_affected($q$update public.store_settings set name = 'hacked'$q$), 0::bigint,
  'staff cannot edit store info columns directly (policy)');
select is(public.test_rows_affected($q$update public.business_hours set is_closed = true$q$),
  0::bigint, 'staff cannot update business hours');
select is((select count(*) from public.admin_audit_log), 0::bigint, 'staff cannot read the audit log');
reset role;

select is((select count(*) from public.admin_audit_log where entity = 'store_settings'
  and actor_id = '00000000-0000-4000-8000-0000000000b1') - current_setting('t.audit_ss_b1')::bigint, 2::bigint, 'both status changes are audited with the staff actor');

-- ===== admin =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.store_settings set name = '새 이름', phone = '010', daily_summary = false$$,
  'admin edits store info and notification flags');
select is((select name from public.store_settings), '새 이름', 'admin store info saved');
select throws_ok($$update public.store_settings set is_open = true$$, '42501', null,
  'even admin changes status only through set_store_status');
select lives_ok($$select * from public.set_store_status(true, true)$$, 'admin reopens the store');
select lives_ok($$update public.business_hours set opens_at = '07:30', closes_at = '22:00' where weekday = 0$$,
  'admin updates business hours');
select throws_ok($$update public.business_hours set opens_at = '22:00', closes_at = '08:00' where weekday = 1$$,
  '23514', null, 'closing time must be after opening time unless closed');
select lives_ok($$update public.business_hours set is_closed = true, opens_at = '22:00', closes_at = '08:00' where weekday = 1$$,
  'a closed day may keep any times');
select throws_ok($$update public.store_settings set pending_payment_ttl_minutes = 1$$, '23514', null,
  'payment TTL must be 5-60 minutes');
select cmp_ok((select count(*) from public.admin_audit_log where entity = 'store_settings') - current_setting('t.audit_ss_all')::bigint, '>=', 4::bigint,
  'admin sees the audit rows');
reset role;

select is((select count(*) from public.admin_audit_log where entity = 'business_hours'
  and actor_id = '00000000-0000-4000-8000-0000000000a1') - current_setting('t.audit_bh_a1')::bigint, 2::bigint, 'business hours changes are audited with the admin actor');

select * from finish();
rollback;
