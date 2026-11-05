-- Phase (b) storage policies for the menu-images bucket and the store:catalog broadcast (plan sections 2, 6, 11.1).
-- Requirement: SA-04 (images), SW-07/SW-08/SA-05 (catalog changes reach other clients).
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

select plan(22);

-- The Storage API sets this when it deletes on behalf of a user; RLS still applies to the delete.
select set_config('storage.allow_delete_query', 'true', true);

select is((select public from storage.buckets where id = 'menu-images'), true, 'menu-images is a public bucket');
select is((select file_size_limit from storage.buckets where id = 'menu-images'), 2097152::bigint, 'images are limited to 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'menu-images'),
  array['image/jpeg', 'image/png', 'image/webp'], 'only jpeg, png and webp are allowed');

insert into storage.objects (bucket_id, name) values ('menu-images', 'seed-owned.png');

-- ===== anon =====
set local role anon;
select is((select count(*) from storage.objects where bucket_id = 'menu-images'), 1::bigint, 'anon can read menu images');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('menu-images', 'anon.png')$$, '42501', null,
  'anon cannot upload');
select is(public.test_rows_affected($q$delete from storage.objects where bucket_id = 'menu-images'$q$), 0::bigint,
  'anon cannot delete');
reset role;

-- ===== customer =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'menu-images'), 1::bigint, 'customer can read menu images');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('menu-images', 'customer.png')$$, '42501', null,
  'customer cannot upload');
select is(public.test_rows_affected($q$update storage.objects set name = 'renamed.png' where bucket_id = 'menu-images'$q$),
  0::bigint, 'customer cannot replace an image');
select is(public.test_rows_affected($q$delete from storage.objects where bucket_id = 'menu-images'$q$), 0::bigint,
  'customer cannot delete an image');
reset role;

-- ===== staff (both permissions) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('menu-images', 'staff.png')$$, '42501', null,
  'staff cannot upload');
select is(public.test_rows_affected($q$delete from storage.objects where bucket_id = 'menu-images'$q$), 0::bigint,
  'staff cannot delete an image');
reset role;

-- ===== admin =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into storage.objects (bucket_id, name) values ('menu-images', 'admin.png')$$, 'admin uploads an image');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('some-other-bucket', 'admin.png')$$, '42501', null,
  'the policy covers the menu-images bucket only');
select is(public.test_rows_affected($q$update storage.objects set name = 'admin2.png' where name = 'admin.png'$q$),
  1::bigint, 'admin replaces an image');
select is(public.test_rows_affected($q$delete from storage.objects where bucket_id = 'menu-images' and name = 'admin2.png'$q$),
  1::bigint, 'admin deletes an image');
reset role;

-- ===== store:catalog broadcast =====
delete from realtime.messages where topic = 'store:catalog';
update public.menu_items set is_sold_out = true where id = '00000000-0000-4000-8000-000000000201';
update public.store_settings set name = 'rename does not broadcast' where id = 1;
select is((select count(*) from realtime.messages where topic = 'store:catalog' and event = 'menu_updated'
  and (payload ->> 'menuItemId') = '00000000-0000-4000-8000-000000000201' and private), 1::bigint,
  'a menu change sends a private menu_updated message with ids only');
select is((select count(*) from realtime.messages where event = 'store_status_updated'), 0::bigint,
  'editing store info does not broadcast a status change');
update public.store_settings set is_accepting_orders = false where id = 1;
select is((select payload - 'id' from realtime.messages where event = 'store_status_updated'),
  '{"isOpen": true, "isAcceptingOrders": false}'::jsonb, 'a status change broadcasts only the two switch values');

-- Subscription policy: signed-in users may read the catalog topic only.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select set_config('realtime.topic', 'store:catalog', true);
select cmp_ok((select count(*) from realtime.messages where extension = 'broadcast'), '>=', 2::bigint,
  'a signed-in customer can listen to store:catalog');
select set_config('realtime.topic', 'store:orders', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint,
  'the catalog policy does not open other topics');
reset role;
set local role anon;
select set_config('realtime.topic', 'store:catalog', true);
select is((select count(*) from realtime.messages where extension = 'broadcast'), 0::bigint, 'anon cannot listen to store:catalog');
reset role;

select * from finish();
rollback;
