-- Phase (b) menu (migration 5): categories, items, the menu-images bucket and its policies.
-- Admin "삭제" archives an item (archived_at) instead of deleting it so past orders keep their reference (OQ-41).
-- Categories are never deleted; they can be deactivated.

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index menu_categories_name_key on public.menu_categories (name);
create index menu_categories_sort_order_idx on public.menu_categories (sort_order);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 30),
  description text not null default '' check (char_length(description) <= 100),
  price integer not null check (price between 0 and 100000),
  -- Empty means the item has no temperature choice (OQ-16). HOT / ICE only (PRD ORD-04).
  temperatures public.temperature[] not null default '{}'
    check (
      cardinality(temperatures) <= 2
      and array_position(temperatures, null) is null
      and (cardinality(temperatures) < 2 or temperatures[1] <> temperatures[2])
    ),
  image_path text check (char_length(image_path) <= 200),
  is_sold_out boolean not null default false,
  -- false = 판매 중지: hidden from customers.
  is_active boolean not null default true,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_category_sort_idx on public.menu_items (category_id, sort_order)
  where archived_at is null;

create trigger menu_categories_set_updated_at
  before update on public.menu_categories
  for each row execute function private.set_updated_at();
create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function private.set_updated_at();

create trigger menu_categories_audit
  after insert or update on public.menu_categories
  for each row execute function private.audit_admin_change('id');
create trigger menu_items_audit
  after insert or update on public.menu_items
  for each row execute function private.audit_admin_change('id');

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

-- Writes are admin-only by policy. Staff change sold-out through set_menu_item_sold_out.
revoke all on public.menu_categories, public.menu_items from anon, authenticated;
grant select on public.menu_categories, public.menu_items to anon, authenticated;
grant insert, update on public.menu_categories, public.menu_items to authenticated;

-- Categories: customers and anonymous callers see active ones; staff and admins see all.
create policy menu_categories_select_active on public.menu_categories
  for select to anon, authenticated using (is_active);
create policy menu_categories_select_staff on public.menu_categories
  for select to authenticated using ((select private.is_active_staff()));
create policy menu_categories_admin_insert on public.menu_categories
  for insert to authenticated with check ((select private.is_admin()));
create policy menu_categories_admin_update on public.menu_categories
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Items: customers see visible, non-archived items in active categories (the sub-select is itself
-- filtered by the caller's category policies). Staff see all non-archived; admins also see archived.
create policy menu_items_select_visible on public.menu_items
  for select to anon, authenticated
  using (
    is_active
    and archived_at is null
    and exists (select 1 from public.menu_categories c where c.id = category_id)
  );
create policy menu_items_select_staff on public.menu_items
  for select to authenticated
  using ((select private.is_active_staff()) and archived_at is null);
create policy menu_items_select_admin on public.menu_items
  for select to authenticated using ((select private.is_admin()));
create policy menu_items_admin_insert on public.menu_items
  for insert to authenticated with check ((select private.is_admin()));
create policy menu_items_admin_update on public.menu_items
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- SW-07: staff with MANAGE_OPERATIONS (and admins) mark an item sold out or available again.
create function public.set_menu_item_sold_out(p_menu_item_id uuid, p_is_sold_out boolean)
returns table (id uuid, is_sold_out boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.has_staff_permission('MANAGE_OPERATIONS')) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return query
    update public.menu_items m
       set is_sold_out = p_is_sold_out
     where m.id = p_menu_item_id and m.archived_at is null
    returning m.id, m.is_sold_out;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
end;
$$;

-- Saves a new category order: p_ids must list every category exactly once.
create function public.admin_reorder_categories(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  select count(*) into total from public.menu_categories;
  if p_ids is null
     or cardinality(p_ids) <> total
     or (select count(distinct x) from unnest(p_ids) x) <> total
     or exists (
       select 1 from unnest(p_ids) x where not exists (select 1 from public.menu_categories c where c.id = x)
     )
  then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  update public.menu_categories c
     set sort_order = o.position
    from unnest(p_ids) with ordinality as o(category_id, position)
   where c.id = o.category_id;
  return total;
end;
$$;

revoke execute on function
  public.set_menu_item_sold_out(uuid, boolean),
  public.admin_reorder_categories(uuid[])
from public, anon;
grant execute on function
  public.set_menu_item_sold_out(uuid, boolean),
  public.admin_reorder_categories(uuid[])
to authenticated;

-- Product photos (SA-04). Public read so the customer app can show them by URL; only admins write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy menu_images_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'menu-images');
create policy menu_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-images' and (select private.is_admin()));
create policy menu_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-images' and (select private.is_admin()))
  with check (bucket_id = 'menu-images' and (select private.is_admin()));
create policy menu_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-images' and (select private.is_admin()));
