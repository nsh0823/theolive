-- Phase (f), migration 14 in the plan numbering: Store Admin sales aggregates (SA-01/02) and 회원관리 (SA-12).
-- Everything here is admin-only and read-only. Members' email and phone are masked INSIDE the database
-- (`private.mask_email` / `private.mask_phone`); no function here returns raw `auth.users` contact data, and staff
-- accounts (even with every permission) are refused.

-- The orders that count as sales, one row each, with the net amount (paid minus refunds that succeeded).
-- Excluded: unpaid checkouts, cancelled, rejected, and orders whose payment was refunded in full.
-- The business day is the Asia/Seoul calendar date of paid_at (the same date orders.business_date is set from).
create view private.counted_orders as
select o.id,
       o.customer_id,
       o.order_number,
       o.status,
       o.payment_status,
       o.paid_at,
       (o.paid_at at time zone 'Asia/Seoul')::date as business_day,
       greatest(
         o.paid_amount - coalesce((select sum(r.amount)
                                     from public.refunds r
                                     join public.payments p on p.id = r.payment_id
                                    where p.order_id = o.id and r.status = 'SUCCEEDED'), 0),
         0)::integer as net_amount
  from public.orders o
 where o.paid_at is not null
   and o.status in ('PAID', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED')
   and o.payment_status in ('PAID', 'PARTIAL_REFUNDED');
revoke all on private.counted_orders from public, anon, authenticated;

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_admin() then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
end;
$$;

-- ===== sales =====
create function public.admin_sales_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days jsonb;
  v_total bigint;
  v_count bigint;
begin
  perform private.require_admin();
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  with days as (
    select d::date as day,
           coalesce(sum(c.net_amount), 0) as sales,
           count(c.id) as orders
      from generate_series(p_from, p_to, interval '1 day') d
      left join private.counted_orders c on c.business_day = d::date
     group by d
  )
  select coalesce(jsonb_agg(jsonb_build_object('date', day, 'sales', sales, 'orderCount', orders) order by day), '[]'),
         coalesce(sum(sales), 0), coalesce(sum(orders), 0)
    into v_days, v_total, v_count
    from days;
  return jsonb_build_object(
    'days', v_days,
    'total', v_total,
    'orderCount', v_count,
    'averageAmount', case when v_count = 0 then 0 else round(v_total::numeric / v_count) end);
end;
$$;

create function public.admin_popular_items(p_from date, p_to date, p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('name', t.name, 'quantity', t.quantity) order by t.quantity desc, t.name)
      from (select oi.name_snapshot as name, sum(oi.quantity)::integer as quantity
              from public.order_items oi
              join private.counted_orders c on c.id = oi.order_id
             where c.business_day between p_from and p_to
             group by oi.name_snapshot
             order by sum(oi.quantity) desc, oi.name_snapshot
             limit greatest(least(coalesce(p_limit, 5), 20), 1)) t), '[]');
end;
$$;

-- ===== members (회원관리) =====
-- Members are customers: deleted accounts and staff accounts are not listed.
create function private.member_login_provider(p_raw_app_meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(nullif(p_raw_app_meta ->> 'provider', ''), 'EMAIL'));
$$;

create function public.admin_list_members(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_like text;
  v_limit integer := greatest(least(coalesce(p_limit, 50), 100), 1);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform private.require_admin();
  -- Nickname or order number only (never email or phone); % and _ are matched literally.
  v_like := case when v_search is null then null else
    '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  return (
    with hits as (
      select p.id, p.nickname, p.created_at
        from public.profiles p
       where p.deleted_at is null
         and not exists (select 1 from public.staff_members s where s.user_id = p.id)
         and (v_search is null
              or p.nickname ilike v_like escape '\'
              or exists (select 1 from private.counted_orders c
                          where c.customer_id = p.id and upper(c.order_number) = upper(v_search)))
    ),
    page as (
      select h.id, h.nickname, h.created_at, u.email, u.phone, u.raw_app_meta_data
        from hits h
        join auth.users u on u.id = h.id
       order by h.created_at desc, h.id
       limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', g.id,
                 'nickname', g.nickname,
                 'maskedEmail', private.mask_email(g.email),
                 'maskedPhone', private.mask_phone(g.phone),
                 'provider', private.member_login_provider(g.raw_app_meta_data),
                 'joinedAt', g.created_at,
                 'orderCount', coalesce(st.order_count, 0),
                 'totalSpent', coalesce(st.total_spent, 0),
                 'lastOrderAt', st.last_order_at) order by g.created_at desc, g.id)
          from page g
          left join lateral (select count(*)::integer as order_count,
                                    sum(c.net_amount)::integer as total_spent,
                                    max(c.paid_at) as last_order_at
                               from private.counted_orders c where c.customer_id = g.id) st on true), '[]'),
      'total', (select count(*) from hits))
  );
end;
$$;

create function public.admin_get_member(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.profiles;
  u auth.users;
begin
  perform private.require_admin();
  select * into p from public.profiles x where x.id = p_member_id;
  if not found or p.deleted_at is not null
     or exists (select 1 from public.staff_members s where s.user_id = p.id) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into u from auth.users x where x.id = p.id;
  return jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'maskedEmail', private.mask_email(u.email),
    'maskedPhone', private.mask_phone(u.phone),
    'provider', private.member_login_provider(u.raw_app_meta_data),
    'joinedAt', p.created_at,
    'orderCount', (select count(*) from private.counted_orders c where c.customer_id = p.id),
    'totalSpent', (select coalesce(sum(c.net_amount), 0) from private.counted_orders c where c.customer_id = p.id),
    'lastOrderAt', (select max(c.paid_at) from private.counted_orders c where c.customer_id = p.id),
    -- Two separate assets with two separate ledgers; they are never merged or summed.
    'stampBalance', coalesce((select b.balance from public.stamp_balances b where b.user_id = p.id), 0),
    'pointBalance', private.usable_points(p.id),
    'stampLedger', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'kind', t.kind, 'label', t.label, 'delta', t.delta,
               'balanceAfter', t.balance_after, 'createdAt', t.created_at) order by t.created_at desc, t.id desc)
        from (select * from public.stamp_transactions x where x.user_id = p.id
               order by x.created_at desc, x.id desc limit 200) t), '[]'),
    'pointLedger', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'kind', t.kind, 'label', t.label, 'delta', t.delta,
               'balanceAfter', t.balance_after, 'createdAt', t.created_at) order by t.created_at desc, t.id desc)
        from (select * from public.coupon_point_transactions x where x.user_id = p.id
               order by x.created_at desc, x.id desc limit 200) t), '[]'),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'orderNumber', o.order_number, 'status', o.status, 'paymentStatus', o.payment_status,
               'paidAmount', o.paid_amount, 'placedAt', o.paid_at) order by o.paid_at desc, o.id)
        from (select * from public.orders x where x.customer_id = p.id and x.paid_at is not null
               order by x.paid_at desc, x.id limit 50) o), '[]'));
end;
$$;

-- ===== grants =====
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_admin(), private.is_active_staff(), private.has_staff_permission(public.staff_permission)
to authenticated;

revoke execute on function
  public.admin_sales_summary(date, date),
  public.admin_popular_items(date, date, integer),
  public.admin_list_members(text, integer, integer),
  public.admin_get_member(uuid)
from public, anon, authenticated;
grant execute on function
  public.admin_sales_summary(date, date),
  public.admin_popular_items(date, date, integer),
  public.admin_list_members(text, integer, integer),
  public.admin_get_member(uuid)
to authenticated;
