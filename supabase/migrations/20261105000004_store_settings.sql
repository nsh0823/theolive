-- Phase (b) store settings and business hours (migration 4).
-- Hours are display-only (OQ-11 option a): the manual is_open / is_accepting_orders switches decide.
-- Staff with MANAGE_OPERATIONS change only the two status switches, through set_store_status.
-- Admins change everything else with plain updates guarded by RLS.

create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null check (char_length(name) between 1 and 40),
  phone text not null default '' check (char_length(phone) <= 20),
  address text not null default '' check (char_length(address) <= 100),
  description text not null default '' check (char_length(description) <= 200),
  is_open boolean not null default false,
  is_accepting_orders boolean not null default false,
  pending_payment_ttl_minutes smallint not null default 15 check (pending_payment_ttl_minutes between 5 and 60),
  new_order_sound boolean not null default true,
  new_order_banner boolean not null default true,
  sold_out_reminder boolean not null default true,
  daily_summary boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create index store_settings_updated_by_idx on public.store_settings (updated_by);

-- The single row always exists; the app never inserts or deletes it.
insert into public.store_settings (id, name) values (1, '더 올리브');

create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_closed boolean not null default false,
  opens_at time not null default '09:00',
  closes_at time not null default '21:00',
  updated_at timestamptz not null default now(),
  constraint business_hours_open_before_close check (is_closed or closes_at > opens_at)
);

-- 0 = Monday ... 6 = Sunday (store WEEKDAY).
insert into public.business_hours (weekday) select generate_series(0, 6);

-- Records who changed the row; the audit trigger records the full before/after.
create function private.set_updated_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function private.set_updated_at();

create trigger store_settings_set_updated_by
  before update on public.store_settings
  for each row execute function private.set_updated_by();

create trigger business_hours_set_updated_at
  before update on public.business_hours
  for each row execute function private.set_updated_at();

create trigger store_settings_audit
  after update on public.store_settings
  for each row execute function private.audit_admin_change('id');

create trigger business_hours_audit
  after insert or update on public.business_hours
  for each row execute function private.audit_admin_change('weekday');

alter table public.store_settings enable row level security;
alter table public.business_hours enable row level security;

-- Grants: nothing for anon. Writes are limited to admins by policy.
revoke all on public.store_settings, public.business_hours from anon, authenticated;
grant select on public.store_settings, public.business_hours to authenticated;
grant update (
  name, phone, address, description, pending_payment_ttl_minutes,
  new_order_sound, new_order_banner, sold_out_reminder, daily_summary
) on public.store_settings to authenticated;
grant insert, update on public.business_hours to authenticated;

create policy store_settings_select on public.store_settings
  for select to authenticated using (true);
create policy store_settings_admin_update on public.store_settings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy business_hours_select on public.business_hours
  for select to authenticated using (true);
create policy business_hours_admin_insert on public.business_hours
  for insert to authenticated with check ((select private.is_admin()));
create policy business_hours_admin_update on public.business_hours
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Staff with MANAGE_OPERATIONS (and admins) toggle the two status switches (SW-08, SA-05).
-- A null argument leaves that switch unchanged.
create function public.set_store_status(
  p_is_open boolean default null,
  p_is_accepting_orders boolean default null
)
returns public.store_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.store_settings;
begin
  if not (select private.has_staff_permission('MANAGE_OPERATIONS')) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  update public.store_settings s
     set is_open = coalesce(p_is_open, s.is_open),
         is_accepting_orders = coalesce(p_is_accepting_orders, s.is_accepting_orders)
   where s.id = 1
   returning * into result;
  return result;
end;
$$;

revoke all on function public.set_store_status(boolean, boolean) from public, anon;
grant execute on function public.set_store_status(boolean, boolean) to authenticated;
