-- Phase (b) RLS and RPCs: menu_categories and menu_items (plan sections 2 and 11.1).
-- Requirement: ORD-01, ORD-03, ORD-04, ORD-09, SW-07, SA-03, SA-04 (archive instead of delete, OQ-41; empty temperatures, OQ-16).
begin;

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

select plan(50);

-- Counts below only look at the deterministic seed/test ids (prefix 00000000-0000-4000-8000-0000): API integration
-- tests commit menu rows with random ids that must not change them.
-- Audit baselines: other suites (API integration tests) leave committed audit rows behind, so assertions
-- below compare against the count taken here instead of an absolute number.
select set_config('t.audit_201_b1', (select count(*) from public.admin_audit_log where entity = 'menu_items'
  and entity_id = '00000000-0000-4000-8000-000000000201' and actor_id = '00000000-0000-4000-8000-0000000000b1')::text, true);
select set_config('t.audit_cat_a1', (select count(*) from public.admin_audit_log where entity = 'menu_categories'
  and actor_id = '00000000-0000-4000-8000-0000000000a1' and action = 'INSERT')::text, true);

-- Extra rows as the owner: an inactive category with an item, an inactive item, an archived item.
insert into public.menu_categories (id, name, sort_order, is_active)
  values ('00000000-0000-4000-8000-000000000199', '숨김 카테고리', 9, false);
insert into public.menu_items (id, category_id, name, price, is_active, archived_at) values
  ('00000000-0000-4000-8000-000000000299', '00000000-0000-4000-8000-000000000199', '숨김 카테고리 메뉴', 1000, true, null),
  ('00000000-0000-4000-8000-000000000298', '00000000-0000-4000-8000-000000000101', '판매 중지 메뉴', 1000, false, null),
  ('00000000-0000-4000-8000-000000000297', '00000000-0000-4000-8000-000000000101', '삭제된 메뉴', 1000, true, now());

-- ===== anon: public read of visible items only =====
set local role anon;
select is((select count(*) from public.menu_items where id::text like '00000000-0000-4000-8000-0000%'), 9::bigint, 'anon sees only visible, non-archived items in active categories');
select is((select count(*) from public.menu_categories where id::text like '00000000-0000-4000-8000-0000%'), 5::bigint, 'anon sees only active categories');
select is((select count(*) from public.menu_items where name in ('판매 중지 메뉴', '삭제된 메뉴', '숨김 카테고리 메뉴')),
  0::bigint, 'anon cannot see inactive, archived or hidden-category items');
select throws_ok($$insert into public.menu_items (category_id, name, price)
  values ('00000000-0000-4000-8000-000000000101', 'x', 1)$$, '42501', null, 'anon cannot insert items');
select throws_ok($$update public.menu_items set price = 1$$, '42501', null, 'anon cannot update items');
select throws_ok($$select * from public.set_menu_item_sold_out('00000000-0000-4000-8000-000000000201', true)$$,
  '42501', null, 'anon cannot call set_menu_item_sold_out');
select throws_ok($$select * from public.admin_reorder_categories('{}')$$, '42501', null, 'anon cannot reorder categories');
reset role;

-- ===== customer1 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.menu_items where id::text like '00000000-0000-4000-8000-0000%'), 9::bigint, 'customer sees visible items only');
select is((select count(*) from public.menu_categories where id::text like '00000000-0000-4000-8000-0000%'), 5::bigint, 'customer sees active categories only');
select throws_ok($$insert into public.menu_items (category_id, name, price)
  values ('00000000-0000-4000-8000-000000000101', 'x', 1)$$, '42501', null, 'customer cannot insert items');
select throws_ok($$insert into public.menu_categories (name) values ('x')$$, '42501', null, 'customer cannot insert categories');
select is(public.test_rows_affected($q$update public.menu_items set price = 1$q$), 0::bigint, 'customer update affects no rows');
select is(public.test_rows_affected($q$update public.menu_categories set name = 'x'$q$), 0::bigint, 'customer cannot rename categories');
select throws_ok($$select * from public.set_menu_item_sold_out('00000000-0000-4000-8000-000000000201', true)$$,
  'P0001', 'FORBIDDEN', 'customer cannot mark sold out');
select throws_ok($$select * from public.admin_reorder_categories('{}')$$, 'P0001', 'FORBIDDEN', 'customer cannot reorder categories');
select throws_ok($$delete from public.menu_items$$, '42501', null, 'customer cannot delete items');
reset role;

-- ===== barista (PROCESS_ORDERS only) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.menu_items where id::text like '00000000-0000-4000-8000-0000%'), 11::bigint, 'staff sees all non-archived items, including inactive ones');
select is((select count(*) from public.menu_categories where id::text like '00000000-0000-4000-8000-0000%'), 6::bigint, 'staff sees inactive categories');
select throws_ok($$select * from public.set_menu_item_sold_out('00000000-0000-4000-8000-000000000201', true)$$,
  'P0001', 'FORBIDDEN', 'staff without MANAGE_OPERATIONS cannot mark sold out');
select is(public.test_rows_affected($q$update public.menu_items set is_sold_out = true$q$), 0::bigint,
  'staff without MANAGE_OPERATIONS cannot update items directly');
reset role;

-- ===== inactive staff =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.menu_items where id::text like '00000000-0000-4000-8000-0000%'), 9::bigint, 'inactive staff reads like a customer');
select throws_ok($$select * from public.set_menu_item_sold_out('00000000-0000-4000-8000-000000000201', true)$$,
  'P0001', 'FORBIDDEN', 'inactive staff cannot mark sold out');
reset role;

-- ===== staff with MANAGE_OPERATIONS =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select is((select is_sold_out from public.set_menu_item_sold_out('00000000-0000-4000-8000-000000000201', true)), true,
  'staff marks an item sold out');
select is((select is_sold_out from public.menu_items where id = '00000000-0000-4000-8000-000000000201'), true,
  'sold-out state is stored');
select is((select is_sold_out from public.set_menu_item_sold_out('00000000-0000-4000-8000-000000000201', false)), false,
  'staff marks the item available again');
select throws_ok($$select * from public.set_menu_item_sold_out('00000000-0000-4000-8000-000000000297', true)$$,
  'P0001', 'NOT_FOUND', 'an archived item cannot be toggled');
select throws_ok($$select * from public.set_menu_item_sold_out('00000000-0000-4000-8000-0000000009ff', true)$$,
  'P0001', 'NOT_FOUND', 'an unknown item cannot be toggled');
select is(public.test_rows_affected($q$update public.menu_items set price = 1$q$), 0::bigint,
  'staff cannot change prices directly');
select throws_ok($$insert into public.menu_items (category_id, name, price)
  values ('00000000-0000-4000-8000-000000000101', 'x', 1)$$, '42501', null, 'staff cannot insert items');
select throws_ok($$select * from public.admin_reorder_categories('{}')$$, 'P0001', 'FORBIDDEN', 'staff cannot reorder categories');
reset role;
select is((select count(*) from public.admin_audit_log where entity = 'menu_items'
  and entity_id = '00000000-0000-4000-8000-000000000201' and actor_id = '00000000-0000-4000-8000-0000000000b1')
  - current_setting('t.audit_201_b1')::bigint,
  2::bigint, 'sold-out toggles are audited with the staff actor');

-- ===== admin =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.menu_items where id in (
  '00000000-0000-4000-8000-000000000299', '00000000-0000-4000-8000-000000000298', '00000000-0000-4000-8000-000000000297')),
  3::bigint, 'admin sees the rows this test created, including the archived item');
select is((select count(*) from public.menu_categories where id::text like '00000000-0000-4000-8000-0000%'), 6::bigint, 'admin sees all categories');
select lives_ok($$insert into public.menu_categories (id, name, sort_order)
  values ('00000000-0000-4000-8000-000000000106', '시즌', 6)$$, 'admin adds a category');
select throws_ok($$insert into public.menu_categories (name) values ('시즌')$$, '23505', null, 'category names are unique');
select throws_ok($$insert into public.menu_categories (name) values ('')$$, '23514', null, 'category name cannot be empty');
select lives_ok($$insert into public.menu_items (id, category_id, name, price, temperatures)
  values ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000106', '시즌 라떼', 6000, '{HOT}')$$,
  'admin adds an item');
select lives_ok($$insert into public.menu_items (category_id, name, price, temperatures)
  values ('00000000-0000-4000-8000-000000000106', '병 음료', 3000, '{}')$$, 'an item may have no temperature choice (OQ-16)');
select throws_ok($$insert into public.menu_items (category_id, name, price, temperatures)
  values ('00000000-0000-4000-8000-000000000106', 'dup', 3000, '{HOT,HOT}')$$, '23514', null, 'duplicate temperatures are rejected');
select throws_ok($$insert into public.menu_items (category_id, name, price)
  values ('00000000-0000-4000-8000-000000000106', 'neg', -1)$$, '23514', null, 'negative price is rejected');
select throws_ok($$insert into public.menu_items (category_id, name, price)
  values ('00000000-0000-4000-8000-000000000106', 'big', 100001)$$, '23514', null, 'price above the maximum is rejected');
select throws_ok($$insert into public.menu_items (category_id, name, price)
  values ('00000000-0000-4000-8000-0000000009ff', 'orphan', 1000)$$, '23503', null, 'item needs an existing category');
select lives_ok($$update public.menu_items set archived_at = now() where id = '00000000-0000-4000-8000-000000000210'$$,
  'admin archives an item');
select is((select count(*) from public.menu_items where id = '00000000-0000-4000-8000-000000000210'), 1::bigint,
  'admin still reads the archived item');
select throws_ok($$delete from public.menu_items$$, '42501', null, 'items are archived, never deleted');
select throws_ok($$delete from public.menu_categories$$, '42501', null, 'categories are never deleted');
select is((select count(*) from public.admin_reorder_categories(
  (select array_agg(id order by name desc) from public.menu_categories))), 1::bigint, 'admin reorders all categories');
select throws_ok($$select * from public.admin_reorder_categories('{00000000-0000-4000-8000-000000000101}')$$,
  'P0001', 'INVALID_INPUT', 'a partial category list is rejected');
reset role;
select is((select count(*) from public.admin_audit_log where entity = 'menu_items'
  and entity_id = '00000000-0000-4000-8000-000000000210' and actor_id = '00000000-0000-4000-8000-0000000000a1'),
  2::bigint, 'item insert and archive are audited with the admin actor');
select is((select count(*) from public.admin_audit_log where entity = 'menu_categories'
  and actor_id = '00000000-0000-4000-8000-0000000000a1' and action = 'INSERT')
  - current_setting('t.audit_cat_a1')::bigint, 1::bigint, 'category insert is audited');

select * from finish();
rollback;
