-- Phase (a) foundation: private schemas, enums, shared trigger functions, admin audit log, masking helpers.
-- See docs/plans/backend-integration.md section 1.1, 1.2, 1.3 and 9 (migration 1).

create schema if not exists private;
create schema if not exists test_pg;

-- Callers never need to browse these schemas; RLS policies only call specific helper functions.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke all on schema test_pg from public, anon, authenticated;
-- Functions in private are callable only where a migration grants execute explicitly.
alter default privileges in schema private revoke execute on functions from public;

create type public.temperature as enum ('HOT', 'ICE');
create type public.order_type as enum ('DINE_IN', 'TAKEOUT');
create type public.order_status as enum (
  'PENDING_PAYMENT', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED'
);
create type public.payment_status as enum (
  'READY', 'PAID', 'FAILED', 'CANCELLED', 'PARTIAL_REFUNDED', 'REFUNDED'
);
create type public.payment_method as enum ('KAKAO_PAY', 'NAVER_PAY', 'TOSS_PAY', 'CARD', 'NONE');
create type public.refund_status as enum ('REQUESTED', 'SUCCEEDED', 'FAILED');
create type public.actor_role as enum ('CUSTOMER', 'STAFF', 'ADMIN', 'SYSTEM');
create type public.staff_role as enum ('ADMIN', 'STAFF');
create type public.staff_permission as enum ('PROCESS_ORDERS', 'MANAGE_OPERATIONS');
create type public.stamp_earn_mode as enum ('PER_ORDER', 'PER_AMOUNT');
create type public.stamp_earn_timing as enum ('PAID', 'ACCEPTED', 'COMPLETED');
create type public.stamp_tx_kind as enum (
  'EARN', 'REDEEM', 'EARN_REVERSAL', 'REDEEM_RESTORE', 'EXPIRE', 'FORFEIT', 'ADJUST'
);
create type public.coupon_benefit_type as enum ('FIXED_AMOUNT', 'FREE_ITEM');
create type public.user_coupon_status as enum ('AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'VOID');
create type public.point_code_status as enum ('UNUSED', 'REGISTERED', 'EXPIRED', 'VOID');
create type public.point_tx_kind as enum (
  'REGISTER', 'USE', 'REFUND_RESTORE', 'EXPIRE', 'FORFEIT', 'ADJUST'
);
create type public.point_hold_status as enum ('HELD', 'CAPTURED', 'RELEASED');
create type public.notification_kind as enum ('ORDER', 'PAYMENT', 'STAMP', 'COUPON', 'POINT', 'NOTICE');
create type public.announcement_status as enum ('PUBLISHED', 'UNPUBLISHED');

-- Shared trigger functions.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Ledger and history tables must never change after insert, for any role.
create function private.prevent_update_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
end;
$$;

-- Append-only trail of admin-managed changes (PRD 10.1, SA-07).
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  entity text not null,
  entity_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_actor_id_idx on public.admin_audit_log (actor_id);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity, entity_id, created_at desc);

create trigger admin_audit_log_append_only
  before update or delete on public.admin_audit_log
  for each row execute function private.prevent_update_delete();

alter table public.admin_audit_log enable row level security;
-- Policies that read it are added with the role helpers (migration 3). No write policy exists: only the
-- audit trigger below (security definer) inserts.
revoke all on public.admin_audit_log from anon, authenticated;

-- Generic audit trigger. TG_ARGV[0] is the primary-key column name of the audited table.
-- The actor is the caller's JWT user, or, for service-role Edge Function writes, the
-- transaction-local `app.actor_id` that the function sets after verifying the caller is an admin.
create function private.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  row_id text;
begin
  actor := coalesce(
    (select auth.uid()),
    nullif(current_setting('app.actor_id', true), '')::uuid
  );
  row_id := to_jsonb(new) ->> tg_argv[0];
  insert into public.admin_audit_log (actor_id, entity, entity_id, action, before, after)
  values (
    actor,
    tg_table_name,
    row_id,
    tg_op,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

-- Masking helpers. Same rules and test vectors as apps/store/src/domain/masking.ts.
create function private.mask_email(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  trimmed text;
  at_pos int;
  local_part text;
  domain_part text;
  keep int;
begin
  if p_email is null then
    return null;
  end if;
  trimmed := btrim(p_email);
  at_pos := length(trimmed) - position('@' in reverse(trimmed)) + 1;
  if position('@' in trimmed) = 0 or at_pos <= 1 or at_pos = length(trimmed) then
    return '***';
  end if;
  local_part := substr(trimmed, 1, at_pos - 1);
  domain_part := substr(trimmed, at_pos + 1);
  keep := case when length(local_part) >= 5 then 4 else 1 end;
  return substr(local_part, 1, keep) || '***@' || domain_part;
end;
$$;

create function private.mask_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text;
  tail text;
  domestic text;
  is_korean boolean;
begin
  if p_phone is null then
    return null;
  end if;
  digits := regexp_replace(p_phone, '\D', '', 'g');
  if length(digits) = 0 then
    return null;
  end if;
  if length(digits) <= 4 then
    return '****';
  end if;
  tail := right(digits, 4);
  domestic := case when digits like '82%' then '0' || substr(digits, 3) else digits end;
  is_korean := case
    when btrim(p_phone) like '+%' then digits like '82%'
    else domestic like '0%'
  end;
  if is_korean and length(domestic) = 11 then
    return left(domestic, 3) || '-****-' || tail;
  end if;
  if is_korean and length(domestic) = 10 then
    return left(domestic, 3) || '-***-' || tail;
  end if;
  return '***-' || tail;
end;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.mask_email(text), private.mask_phone(text) to authenticated, service_role;
