-- Phase (c) realtime (P5): private Broadcast topics `store:orders` and `user:<uid>`.
-- Payloads carry ids and statuses only. Clients treat every event as a hint and refetch.
-- Events: store:orders -> order_paid (a new paid order, plays the alert) and order_updated;
--         user:<uid>   -> order_updated.

create function private.broadcast_order_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object(
    'orderId', new.id, 'status', new.status, 'paymentStatus', new.payment_status, 'updatedAt', new.updated_at);
begin
  if new.customer_id is not null then
    perform realtime.send(v_payload, 'order_updated', 'user:' || new.customer_id, true);
  end if;
  -- Unpaid, failed and expired checkouts never reach the store (PAY-05).
  if new.paid_at is not null then
    perform realtime.send(
      v_payload,
      case when tg_op = 'UPDATE' and old.paid_at is null then 'order_paid' else 'order_updated' end,
      'store:orders', true);
  end if;
  return null;
end;
$$;

create trigger orders_broadcast_insert
  after insert on public.orders
  for each row execute function private.broadcast_order_changed();

create trigger orders_broadcast_update
  after update on public.orders
  for each row
  when (
    old.status is distinct from new.status
    or old.payment_status is distinct from new.payment_status
    or old.paid_at is distinct from new.paid_at
  )
  execute function private.broadcast_order_changed();

-- Staff with PROCESS_ORDERS (and admins) listen to the board topic; customers listen only to their own topic.
create policy realtime_store_orders_read on realtime.messages
  for select to authenticated
  using (
    realtime.topic() = 'store:orders'
    and extension = 'broadcast'
    and (select private.has_staff_permission('PROCESS_ORDERS'))
  );

create policy realtime_user_topic_read on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and realtime.topic() = 'user:' || (select auth.uid())::text
  );
