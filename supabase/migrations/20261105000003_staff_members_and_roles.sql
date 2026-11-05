-- Staff roles, role helpers and admin staff management (migration 3).
-- Roles are read from staff_members on every request (not JWT claims) so deactivation is immediate.

create table public.staff_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  permissions public.staff_permission[] not null default '{PROCESS_ORDERS}',
  display_name text not null check (char_length(display_name) between 1 and 20),
  is_active boolean not null default true,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_members_invited_by_idx on public.staff_members (invited_by);
-- Role helpers filter on active rows only.
create index staff_members_active_role_idx on public.staff_members (role) where is_active;

create trigger staff_members_set_updated_at
  before update on public.staff_members
  for each row execute function private.set_updated_at();

create trigger staff_members_audit
  after insert or update on public.staff_members
  for each row execute function private.audit_admin_change('user_id');

-- Role helpers (security definer, so they work for callers that cannot read staff_members).
create function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid()) and s.is_active
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid()) and s.is_active and s.role = 'ADMIN'
  );
$$;

create function private.has_staff_permission(p public.staff_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid())
      and s.is_active
      and (s.role = 'ADMIN' or p = any (s.permissions))
  );
$$;

-- Role of the caller for order history rows. SYSTEM is never derived from a caller.
create function private.current_actor_role()
returns public.actor_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    else coalesce(
      (select case s.role when 'ADMIN' then 'ADMIN'::public.actor_role else 'STAFF'::public.actor_role end
         from public.staff_members s
        where s.user_id = (select auth.uid()) and s.is_active),
      'CUSTOMER'::public.actor_role
    )
  end;
$$;

grant execute on function
  private.is_active_staff(),
  private.is_admin(),
  private.has_staff_permission(public.staff_permission),
  private.current_actor_role()
to authenticated, service_role;

-- RLS. Writes go through RPCs / the admin-staff Edge Function only.
alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;
grant select on public.staff_members to authenticated;

create policy "Staff read their own row; admins read all"
  on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Admins read the audit log"
  on public.admin_audit_log for select to authenticated
  using ((select private.is_admin()));
grant select on public.admin_audit_log to authenticated;

-- Route gating only (RLS and RPC checks are the boundary). No row for plain customers.
create function public.get_my_staff_role()
returns table (role public.staff_role, permissions public.staff_permission[], is_active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.role, s.permissions, s.is_active
  from public.staff_members s
  where s.user_id = (select auth.uid());
$$;

create function public.admin_list_staff()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.staff_role,
  permissions public.staff_permission[],
  is_active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return query
    select s.user_id, u.email::text, s.display_name, s.role, s.permissions, s.is_active, s.created_at
    from public.staff_members s
    join auth.users u on u.id = s.user_id
    order by s.created_at;
end;
$$;

create function public.admin_update_staff(
  p_user_id uuid,
  p_role public.staff_role,
  p_permissions public.staff_permission[],
  p_display_name text,
  p_is_active boolean
)
returns public.staff_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.staff_members;
  result public.staff_members;
  other_active_admins int;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_role is null or p_permissions is null or p_is_active is null
     or p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 20 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;

  -- Serialize concurrent admin changes so the last-admin check cannot race.
  perform 1 from public.staff_members where role = 'ADMIN' and is_active for update;

  select * into existing from public.staff_members where user_id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if p_user_id = (select auth.uid()) and p_role <> existing.role then
    raise exception using errcode = 'P0001', message = 'CANNOT_CHANGE_SELF_ROLE';
  end if;

  if existing.role = 'ADMIN' and existing.is_active and not (p_role = 'ADMIN' and p_is_active) then
    select count(*) into other_active_admins
    from public.staff_members
    where role = 'ADMIN' and is_active and user_id <> p_user_id;
    if other_active_admins = 0 then
      raise exception using errcode = 'P0001', message = 'LAST_ADMIN';
    end if;
  end if;

  update public.staff_members
     set role = p_role,
         permissions = p_permissions,
         display_name = btrim(p_display_name),
         is_active = p_is_active
   where user_id = p_user_id
   returning * into result;
  return result;
end;
$$;

-- Called only by the admin-staff Edge Function (service role) after it verified the caller is an admin.
-- p_actor_id feeds the audit trigger because the service-role connection has no auth.uid().
create function public.admin_create_staff_record(
  p_actor_id uuid,
  p_user_id uuid,
  p_role public.staff_role,
  p_permissions public.staff_permission[],
  p_display_name text
)
returns public.staff_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.staff_members;
begin
  if not exists (
    select 1 from public.staff_members
    where user_id = p_actor_id and is_active and role = 'ADMIN'
  ) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if exists (select 1 from public.staff_members where user_id = p_user_id) then
    raise exception using errcode = 'P0001', message = 'ALREADY_STAFF';
  end if;
  perform set_config('app.actor_id', p_actor_id::text, true);
  insert into public.staff_members (user_id, role, permissions, display_name, invited_by)
  values (p_user_id, p_role, p_permissions, btrim(p_display_name), p_actor_id)
  returning * into result;
  return result;
end;
$$;

-- First production admin: run once by the operator (SQL editor / psql). Not callable through the API.
create function private.bootstrap_admin(p_email text)
returns public.staff_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_name text;
  result public.staff_members;
begin
  if exists (select 1 from public.staff_members where role = 'ADMIN' and is_active) then
    raise exception using errcode = 'P0001', message = 'ADMIN_EXISTS';
  end if;
  select u.id into target_id from auth.users u where lower(u.email) = lower(btrim(p_email));
  if target_id is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select nickname into target_name from public.profiles where id = target_id;
  insert into public.staff_members (user_id, role, permissions, display_name)
  values (
    target_id,
    'ADMIN',
    '{PROCESS_ORDERS,MANAGE_OPERATIONS}',
    coalesce(target_name, '점주')
  )
  returning * into result;
  return result;
end;
$$;

revoke execute on function
  public.get_my_staff_role(),
  public.admin_list_staff(),
  public.admin_update_staff(uuid, public.staff_role, public.staff_permission[], text, boolean),
  public.admin_create_staff_record(uuid, uuid, public.staff_role, public.staff_permission[], text)
from public, anon;
grant execute on function
  public.get_my_staff_role(),
  public.admin_list_staff(),
  public.admin_update_staff(uuid, public.staff_role, public.staff_permission[], text, boolean)
to authenticated;
revoke execute on function
  public.admin_create_staff_record(uuid, uuid, public.staff_role, public.staff_permission[], text)
from authenticated;
grant execute on function
  public.admin_create_staff_record(uuid, uuid, public.staff_role, public.staff_permission[], text)
to service_role;
revoke execute on function private.bootstrap_admin(text) from public, anon, authenticated, service_role;
