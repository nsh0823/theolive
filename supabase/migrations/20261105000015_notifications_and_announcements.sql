-- Phase (f), migration 13 in the plan numbering: in-app notifications, notification preferences, announcements
-- (공지), the reward summary for Home. Push notifications are out of the MVP (OQ-37): the list below is the only
-- delivery, plus a `notification_created` Broadcast hint on `user:<uid>` that tells the app to refetch.
--
-- Notifications are written only by triggers on the tables that hold the source event (orders, stamp ledger,
-- issued coupons, point ledger, announcements), never by a client and never by the code that moves money. That keeps
-- the business functions untouched and makes the notification follow the committed fact. Every insert goes through
-- `private.notify`, which is idempotent per source event (`dedupe_key` unique) and respects the member's
-- preferences: `order_updates` covers ORDER, PAYMENT, STAMP, COUPON and POINT (everything that follows a member's own
-- activity), `notices` covers NOTICE. A switched-off kind creates no row at all.

-- ===== notifications =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 500),
  order_id uuid references public.orders (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  dedupe_key text not null unique
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where not is_read;
create index notifications_order_idx on public.notifications (order_id);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  order_updates boolean not null default true,
  notices boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function private.set_updated_at();

-- ===== announcements =====
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 2000),
  status public.announcement_status not null default 'UNPUBLISHED',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_published_at_iff_published check ((status = 'PUBLISHED') = (published_at is not null))
);
create index announcements_status_idx on public.announcements (status, published_at desc);
create index announcements_created_by_idx on public.announcements (created_by);

-- published_at and created_by are never taken from the client: publishing stamps the time, unpublishing clears it.
create function private.announcement_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.created_by := old.created_by;
  end if;
  if new.status = 'PUBLISHED' then
    new.published_at := case
      when tg_op = 'UPDATE' and old.status = 'PUBLISHED' then old.published_at
      else now() end;
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger announcements_before_write
  before insert or update on public.announcements
  for each row execute function private.announcement_before_write();
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function private.set_updated_at();
create trigger announcements_audit
  after insert or update on public.announcements
  for each row execute function private.audit_admin_change('id');

-- ===== row level security =====
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.announcements enable row level security;

revoke all on public.notifications, public.notification_preferences, public.announcements from anon, authenticated;
grant select on public.notifications to authenticated;
-- A member may only flip is_read; every other column is written by the server.
grant update (is_read) on public.notifications to authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id, order_updates, notices), update (order_updates, notices)
  on public.notification_preferences to authenticated;
grant select, delete on public.announcements to authenticated;
grant insert (id, title, body, status), update (title, body, status) on public.announcements to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy announcements_select_published on public.announcements
  for select to authenticated using (status = 'PUBLISHED');
create policy announcements_select_admin on public.announcements
  for select to authenticated using ((select private.is_admin()));
create policy announcements_admin_insert on public.announcements
  for insert to authenticated with check ((select private.is_admin()));
create policy announcements_admin_update on public.announcements
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy announcements_admin_delete on public.announcements
  for delete to authenticated using ((select private.is_admin()));

-- ===== writing a notification =====
-- Returns the new id, or null when the member switched that kind off, the account is deleted, or the source event
-- was already notified (the dedupe key is the source event: order + status, ledger idempotency key, coupon id, ...).
create function private.notify(
  p_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_order_id uuid,
  p_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_enabled boolean;
begin
  if p_user_id is null then
    return null;
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user_id and p.deleted_at is not null) then
    return null;
  end if;
  select case when p_kind = 'NOTICE' then np.notices else np.order_updates end
    into v_enabled from public.notification_preferences np where np.user_id = p_user_id;
  if coalesce(v_enabled, true) = false then
    return null;
  end if;
  insert into public.notifications (user_id, kind, title, body, order_id, dedupe_key)
  values (p_user_id, p_kind, p_title, coalesce(p_body, ''), p_order_id, p_key)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is not null then
    perform realtime.send(
      jsonb_build_object('id', v_id, 'kind', p_kind), 'notification_created', 'user:' || p_user_id, true);
  end if;
  return v_id;
end;
$$;

create function private.format_won(p_amount integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_amount, 'FM999,999,999,990') || '원';
$$;

-- ===== triggers: order status =====
create function private.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suffix text := case when new.order_number is null then '' else ' (' || new.order_number || ')' end;
  v_title text;
  v_body text := '';
begin
  if new.customer_id is null then
    return null;
  end if;
  case new.status
    when 'ACCEPTED' then v_title := '주문이 접수되었어요.' || v_suffix;
    when 'PREPARING' then v_title := '메뉴를 준비하고 있어요.' || v_suffix;
    when 'READY' then v_title := '메뉴가 준비되었어요.' || v_suffix || ' 픽업대에서 메뉴를 픽업해 주세요.';
    when 'COMPLETED' then v_title := '주문이 완료되었어요.' || v_suffix;
    when 'REJECTED' then
      v_title := '매장 사정으로 주문이 거절되었어요.' || v_suffix;
      v_body := '결제하신 금액은 환불돼요.';
    when 'CANCELLED' then
      -- A checkout that never got paid (expired, failed) is shown on the checkout screen, not in the list.
      if new.paid_at is null then
        return null;
      end if;
      v_title := '주문이 취소되었어요.' || v_suffix;
      v_body := '결제하신 금액은 환불돼요.';
    else
      return null;
  end case;
  perform private.notify(new.customer_id, 'ORDER', v_title, v_body, new.id, 'order:' || new.id || ':' || new.status);
  return null;
end;
$$;
create trigger orders_notify_status
  after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function private.notify_order_status();

-- The order number is assigned right after the order becomes PAID, so the payment message waits for it.
create function private.notify_payment_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(
    new.customer_id, 'PAYMENT',
    case when new.paid_amount > 0 then private.format_won(new.paid_amount) || ' ' else '' end
      || '결제가 완료되었어요. (' || new.order_number || ')',
    '', new.id, 'payment:' || new.id || ':PAID');
  return null;
end;
$$;
create trigger orders_notify_payment_completed
  after update of order_number on public.orders
  for each row when (old.order_number is null and new.order_number is not null)
  execute function private.notify_payment_completed();

create function private.notify_payment_refunded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(
    new.customer_id, 'PAYMENT',
    case when new.paid_amount > 0 then private.format_won(new.paid_amount) || '이 ' else '' end
      || '환불되었어요.' || case when new.order_number is null then '' else ' (' || new.order_number || ')' end,
    '', new.id, 'payment:' || new.id || ':REFUNDED');
  return null;
end;
$$;
create trigger orders_notify_payment_refunded
  after update of payment_status on public.orders
  for each row when (old.payment_status is distinct from new.payment_status and new.payment_status = 'REFUNDED')
  execute function private.notify_payment_refunded();

-- ===== triggers: rewards =====
create function private.notify_stamp_earned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(
    new.user_id, 'STAMP', '올리브 스탬프 ' || new.delta || '개가 적립되었어요.', '', new.order_id,
    'stamp:' || new.idempotency_key);
  return null;
end;
$$;
create trigger stamp_transactions_notify_earn
  after insert on public.stamp_transactions
  for each row when (new.kind = 'EARN')
  execute function private.notify_stamp_earned();

create function private.notify_coupon_issued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(
    new.user_id, 'COUPON', '스탬프를 쿠폰으로 교환했어요.', new.title_snapshot, null, 'coupon:' || new.id);
  return null;
end;
$$;
create trigger user_coupons_notify_issue
  after insert on public.user_coupons
  for each row execute function private.notify_coupon_issued();

create function private.notify_points_registered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(
    new.user_id, 'POINT', '쿠폰 포인트 ' || private.format_won(new.delta) || '이 등록되었어요.', '', null,
    'point:' || new.idempotency_key || ':' || new.code_id);
  return null;
end;
$$;
create trigger coupon_point_transactions_notify_register
  after insert on public.coupon_point_transactions
  for each row when (new.kind = 'REGISTER')
  execute function private.notify_points_registered();

-- ===== triggers: announcements =====
-- Publishing tells every active member who has notices switched on. One row per member and announcement, so
-- unpublishing and publishing again never notifies twice. A single-store cafe has few members; if this ever grows,
-- move the fan-out to a job.
create function private.notify_announcement_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select p.id from public.profiles p
     where p.deleted_at is null
       and not exists (select 1 from public.staff_members s where s.user_id = p.id)
  loop
    perform private.notify(r.id, 'NOTICE', new.title, '', null, 'notice:' || new.id || ':' || r.id);
  end loop;
  return null;
end;
$$;
create trigger announcements_notify_published_insert
  after insert on public.announcements
  for each row when (new.status = 'PUBLISHED')
  execute function private.notify_announcement_published();
create trigger announcements_notify_published_update
  after update of status on public.announcements
  for each row when (new.status = 'PUBLISHED' and old.status is distinct from new.status)
  execute function private.notify_announcement_published();

-- ===== RPCs =====
create function public.mark_notifications_read(p_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  n integer;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  update public.notifications x set is_read = true
   where x.user_id = v_uid and not x.is_read and (p_ids is null or x.id = any (p_ids));
  get diagnostics n = row_count;
  return jsonb_build_object('updated', n);
end;
$$;

-- HOME-04: both balances and the coupon count in one call. Stamps and Coupon Points stay separate fields; the only
-- thing they share is this response.
create function public.get_my_reward_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_stamps integer;
  v_usable integer;
  v_held integer;
  v_goal integer;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  v_stamps := coalesce((select b.balance from public.stamp_balances b where b.user_id = v_uid), 0);
  v_usable := private.usable_points(v_uid);
  v_held := private.held_points(v_uid);
  -- The next reward to work towards: the smallest active requirement above the balance, else the largest.
  select coalesce(
           min(c.required_stamps) filter (where c.required_stamps > v_stamps),
           max(c.required_stamps))
    into v_goal from public.coupons c where c.is_active;
  return jsonb_build_object(
    'stamps', jsonb_build_object('balance', v_stamps, 'nextGoal', v_goal),
    'points', jsonb_build_object('balance', v_usable, 'available', greatest(v_usable - v_held, 0)),
    'availableCouponCount', (select count(*) from public.user_coupons uc
                              where uc.user_id = v_uid and uc.status = 'AVAILABLE' and uc.expires_at > now()));
end;
$$;

-- ===== retention (OQ-35): notifications are kept for one year =====
create function private.prune_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.notifications x where x.created_at < now() - interval '1 year';
  get diagnostics n = row_count;
  return n;
end;
$$;
select cron.schedule('prune-notifications', '10 15 * * *', $$select private.prune_notifications()$$);

-- ===== grants =====
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_admin(), private.is_active_staff(), private.has_staff_permission(public.staff_permission)
to authenticated;

revoke execute on function
  public.mark_notifications_read(uuid[]),
  public.get_my_reward_summary()
from public, anon, authenticated;
grant execute on function
  public.mark_notifications_read(uuid[]),
  public.get_my_reward_summary()
to authenticated;
