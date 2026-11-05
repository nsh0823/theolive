-- Phase (b) realtime (P5): private Broadcast topic `store:catalog`.
-- Payloads carry ids and switch values only; clients refetch on every event (never patch caches).
-- Order topics are added with the orders migrations in phase (c).

create function private.broadcast_menu_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('menuItemId', new.id), 'menu_updated', 'store:catalog', true);
  return null;
end;
$$;

create function private.broadcast_store_status_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('isOpen', new.is_open, 'isAcceptingOrders', new.is_accepting_orders),
    'store_status_updated', 'store:catalog', true
  );
  return null;
end;
$$;

create trigger menu_items_broadcast
  after insert or update on public.menu_items
  for each row execute function private.broadcast_menu_updated();

create trigger store_settings_broadcast
  after update of is_open, is_accepting_orders on public.store_settings
  for each row execute function private.broadcast_store_status_updated();

-- Signed-in users may listen to the catalog topic; nobody may send from a client.
create policy realtime_store_catalog_read on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'store:catalog' and extension = 'broadcast');
