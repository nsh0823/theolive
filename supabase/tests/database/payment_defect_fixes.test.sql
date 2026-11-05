-- QA defect fixes for phase (c): provider-cancel obligation, null provider id guard, single price snapshot,
-- FK restrict on ordered menu items, and the private schema grants.
-- Every assertion targets rows created here (ids kept in transaction-local settings), never table totals.
begin;

create function public.t_as(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.t_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;
create function public.t_order(p_req uuid, p_lines jsonb) returns uuid language plpgsql as $$
declare r jsonb;
begin
  perform public.t_as('00000000-0000-4000-8000-0000000000c1');
  r := public.create_checkout_order(p_req, 'TAKEOUT', p_lines, null, 0, 'CARD', null);
  perform public.t_owner();
  return (r ->> 'orderId')::uuid;
end $$;
create function public.t_pid(p_order uuid) returns uuid language sql as $$
  select id from public.payments where order_id = p_order;
$$;
create function public.t_apply(p_order uuid, p_outcome text, p_event text, p_provider_id text, p_amount int)
returns jsonb language sql as $$
  select public.apply_payment_result(public.t_pid(p_order), p_outcome, p_provider_id, p_amount, p_event, 'CONFIRM');
$$;

select plan(29);

update public.store_settings set is_open = true, is_accepting_orders = true;

-- ===== 4. an approval without a provider payment id is never accepted =====
select set_config('t.o1', public.t_order('d0000000-0000-4000-8000-000000000001',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1}]'::jsonb)::text, true);
select is(public.t_apply(current_setting('t.o1')::uuid, 'APPROVED', 'nd-1', null, 4500) ->> 'result', 'REJECTED',
  'PAY-05 an approval with a null provider payment id is rejected');
select is(public.t_apply(current_setting('t.o1')::uuid, 'APPROVED', 'nd-2', '', 4500) ->> 'result', 'REJECTED',
  'an approval with an empty provider payment id is rejected');
select is(public.t_apply(current_setting('t.o1')::uuid, 'APPROVED', 'nd-3', '   ', 4500) ->> 'result', 'REJECTED',
  'an approval with a blank provider payment id is rejected');
select is((select row(o.status, o.payment_status)::text from public.orders o where o.id = current_setting('t.o1')::uuid),
  '(PENDING_PAYMENT,READY)', 'the order and payment stay unpaid, left for reconcile');
select is((select count(*) from public.payment_events where payment_id = public.t_pid(current_setting('t.o1')::uuid)),
  0::bigint, 'nothing was recorded, so a later answer with the id is still processed');
select is(public.t_apply(current_setting('t.o1')::uuid, 'APPROVED', 'nd-4', 'tp-1', 4500) ->> 'result', 'APPLIED',
  'the same payment is paid once the provider answer carries its id');

-- ===== 2. an amount-mismatch approval leaves a durable provider-cancel obligation =====
select set_config('t.o2', public.t_order('d0000000-0000-4000-8000-000000000002',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1}]'::jsonb)::text, true);
select is(public.t_apply(current_setting('t.o2')::uuid, 'APPROVED', 'mm-1', 'tp-mm', 1000) ->> 'cancelAtProvider', 'true',
  'a mismatching approval asks for a provider cancel');
select is((select row(c.provider_payment_id, c.amount, c.status, c.attempts)::text from public.provider_cancels c
  where c.payment_id = public.t_pid(current_setting('t.o2')::uuid)), '(tp-mm,1000,REQUESTED,0)',
  'the cancel is persisted with the provider id and the approved amount');
select is(public.t_apply(current_setting('t.o2')::uuid, 'APPROVED', 'mm-2', 'tp-mm', 1000) ->> 'result', 'DUPLICATE',
  'a repeated mismatching approval is a duplicate');
select is((select count(*) from public.provider_cancels c where c.payment_id = public.t_pid(current_setting('t.o2')::uuid)),
  1::bigint, 'still one obligation per payment');
select is((select row(o.status, o.payment_status)::text from public.orders o where o.id = current_setting('t.o2')::uuid),
  '(CANCELLED,FAILED)', 'the order is cancelled and the payment failed');

-- A mismatching approval that lands after expiry is owed a cancel as well.
select set_config('t.o3', public.t_order('d0000000-0000-4000-8000-000000000003',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1}]'::jsonb)::text, true);
select is(public.test_pg_force_expire(public.t_pid(current_setting('t.o3')::uuid)), true, 'the order expires');
select is(public.t_apply(current_setting('t.o3')::uuid, 'APPROVED', 'mm-3', 'tp-late', 1000) ->> 'cancelAtProvider', 'true',
  'a mismatching approval after expiry asks for a provider cancel');
select is((select count(*) from public.provider_cancels c where c.payment_id = public.t_pid(current_setting('t.o3')::uuid)),
  1::bigint, 'and it is persisted');
select is((select status::text from public.payments p where p.id = public.t_pid(current_setting('t.o3')::uuid)), 'CANCELLED',
  'the expired payment is left as it was');

-- ===== 1. a late approval of an expired payment is refunded exactly once =====
select set_config('t.o4', public.t_order('d0000000-0000-4000-8000-000000000004',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":1}]'::jsonb)::text, true);
select public.test_pg_force_expire(public.t_pid(current_setting('t.o4')::uuid));
select is(public.t_apply(current_setting('t.o4')::uuid, 'APPROVED', 'late-1', 'tp-l4', 4500) ->> 'result', 'APPLIED',
  'a cancelled-before-approval payment accepts a late approval');
select public.t_apply(current_setting('t.o4')::uuid, 'APPROVED', 'late-2', 'tp-l4', 4500);
select is((select count(*) from public.refunds r where r.payment_id = public.t_pid(current_setting('t.o4')::uuid)),
  1::bigint, 'exactly one refund is requested however often the approval is seen');

-- ===== 5. checkout prices once: menu_amount equals the item sum =====
select set_config('t.o5', public.t_order('d0000000-0000-4000-8000-000000000005',
  '[{"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"HOT","quantity":2},
    {"menuItemId":"00000000-0000-4000-8000-000000000201","temperature":"ICE","quantity":1},
    {"menuItemId":"00000000-0000-4000-8000-000000000202","temperature":"ICE","quantity":3}]'::jsonb)::text, true);
select is((select count(*) from public.order_items i where i.order_id = current_setting('t.o5')::uuid), 3::bigint,
  'merged lines are inserted from the snapshot');
select is((select o.menu_amount from public.orders o where o.id = current_setting('t.o5')::uuid),
  (select sum(i.line_total)::integer from public.order_items i where i.order_id = current_setting('t.o5')::uuid),
  'menu_amount equals the sum of the inserted line totals');
select is((select o.paid_amount from public.orders o where o.id = current_setting('t.o5')::uuid),
  (select p.amount from public.payments p where p.order_id = current_setting('t.o5')::uuid),
  'the payment amount equals the order amount');

-- ===== 7. ordered menu items cannot be hard deleted =====
select throws_ok($$delete from public.menu_items where id = '00000000-0000-4000-8000-000000000201'$$, '23503', null,
  'a menu item with order history cannot be deleted (archive it instead)');
select is((select confdeltype::text from pg_constraint where conname = 'order_items_menu_item_id_fkey'), 'r',
  'the order_items foreign key is ON DELETE RESTRICT');

-- ===== 6. private schema grants =====
select is(has_schema_privilege('anon', 'private', 'usage'), false, 'anon has no usage on schema private');
select is(has_function_privilege('anon', 'private.is_admin()', 'execute'), false, 'anon cannot execute private.is_admin');
select is(has_function_privilege('authenticated', 'private.is_admin()', 'execute')
  and has_function_privilege('authenticated', 'private.is_active_staff()', 'execute')
  and has_function_privilege('authenticated', 'private.has_staff_permission(public.staff_permission)', 'execute')
  and has_function_privilege('authenticated', 'private.is_account_deleted()', 'execute')
  and has_schema_privilege('authenticated', 'private', 'usage'), true,
  'authenticated keeps only what row-level-security policies call (the three role helpers and the deleted-account check)');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  4::bigint, 'no other private function is executable by anon or authenticated');
select public.t_as('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$select * from private.price_lines('[]'::jsonb)$$, '42501', null, 'a client cannot call private.price_lines');
select throws_ok($$select private.expire_order(gen_random_uuid())$$, '42501', null, 'a client cannot call private.expire_order');
select throws_ok($$select * from public.provider_cancels$$, '42501', null, 'a client cannot read provider_cancels');

select * from finish();
rollback;
