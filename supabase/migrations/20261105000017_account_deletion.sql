-- Phase (f): account deletion (AUTH-04, OQ-34), called only by the `account-delete` Edge Function.
--
-- A PROFILE IS NEVER HARD-DELETED. The stamp and point ledgers, the stamp policies and several other tables
-- reference profiles with `on delete set null`, and the append-only trigger on the ledgers would block that
-- update, so a real delete would fail (or, if forced, break `balance = sum(ledger)`). Deleting an account instead:
--   * ends it: the auth user is banned, its identities, sessions and password are removed and its email is replaced
--     by an unusable address, so it can neither sign in nor refresh a session; a returning social login starts a
--     brand-new account;
--   * scrubs personal data: nickname, avatar and username on the profile, free-text order notes, notifications and
--     preferences. `profiles.deleted_at` marks the account;
--   * forfeits rewards: a FORFEIT row on the stamp ledger and one per point lot on the point ledger (separate
--     ledgers, separate keys), unused coupons become VOID;
--   * retains orders, order items, payments and refunds (legal retention, OQ-34; the period is for the owner and
--     accountant to confirm). They keep `customer_id`, which now points at a scrubbed profile and identifies nobody.
-- It is refused while an order is in progress (PAID..READY); unpaid checkouts are cancelled. It is idempotent.
--
-- Until the access token expires (at most the project's JWT lifetime) a deleted member's old token still verifies,
-- so restrictive row-level policies hide every member-owned table from it and write guards refuse new orders and
-- point registrations.

create function private.is_account_deleted()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.deleted_at is not null);
$$;

create policy deleted_account_blocked on public.profiles
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.orders
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.stamp_balances
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.stamp_transactions
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.user_coupons
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.coupon_point_balances
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.coupon_point_transactions
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.coupon_point_holds
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.notifications
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));
create policy deleted_account_blocked on public.notification_preferences
  as restrictive for all to authenticated using (not (select private.is_account_deleted()));

-- Write guard for the security-definer RPCs, which row-level security does not reach. `for key share` waits for a
-- deletion that is running at the same moment and then sees its result.
create function private.reject_deleted_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := coalesce((to_jsonb(new) ->> 'customer_id')::uuid, (to_jsonb(new) ->> 'user_id')::uuid);
  v_deleted timestamptz;
begin
  if v_uid is null then
    return new;
  end if;
  select p.deleted_at into v_deleted from public.profiles p where p.id = v_uid for key share;
  if v_deleted is not null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return new;
end;
$$;
create trigger orders_reject_deleted_account
  before insert on public.orders
  for each row execute function private.reject_deleted_account();
create trigger coupon_point_transactions_reject_deleted_account
  before insert on public.coupon_point_transactions
  for each row when (new.kind = 'REGISTER')
  execute function private.reject_deleted_account();

-- A profile that owns history cannot be deleted directly (for example by deleting the auth user in the dashboard):
-- say why, instead of failing deep inside the append-only trigger.
create function private.prevent_profile_delete_with_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.orders o where o.customer_id = old.id)
     or exists (select 1 from public.stamp_transactions t where t.user_id = old.id)
     or exists (select 1 from public.coupon_point_transactions t where t.user_id = old.id) then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_DELETE_REQUIRED',
      detail = 'Accounts with orders or reward history are deleted with the account-delete function, never removed.';
  end if;
  return old;
end;
$$;
create trigger profiles_prevent_delete_with_history
  before delete on public.profiles
  for each row execute function private.prevent_profile_delete_with_history();

-- ===== the deletion itself =====
create function private.delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
  r record;
  pay public.payments;
  ord public.orders;
  v_stamps integer;
begin
  select * into p from public.profiles x where x.id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if p.deleted_at is not null then
    return jsonb_build_object('deleted', true, 'isReplay', true);
  end if;
  -- Staff leave through the admin's staff screen, so the last admin can never delete itself by accident.
  if exists (select 1 from public.staff_members s where s.user_id = p_user_id) then
    raise exception using errcode = 'P0001', message = 'STAFF_ACCOUNT_NOT_ALLOWED';
  end if;
  if exists (select 1 from public.orders o
              where o.customer_id = p_user_id and o.status in ('PAID', 'ACCEPTED', 'PREPARING', 'READY')) then
    raise exception using errcode = 'P0001', message = 'ACTIVE_ORDER_EXISTS';
  end if;

  update public.profiles x set deleted_at = now() where x.id = p_user_id;

  -- Unpaid checkouts end here; a late approval of one is refunded like any customer cancellation.
  for r in select o.id from public.orders o where o.customer_id = p_user_id and o.status = 'PENDING_PAYMENT' loop
    ord := private.lock_order(r.id);
    if ord.status = 'PENDING_PAYMENT' then
      select * into pay from public.payments y where y.order_id = ord.id;
      if pay.status = 'READY' then
        perform private.set_payment_status(pay.id, 'CANCELLED', 'CUSTOMER_CANCELLED');
      end if;
      perform private.change_order_status(ord.id, 'CANCELLED', p_user_id, 'CUSTOMER', 'ACCOUNT_DELETED');
      update public.orders o set cancel_reason = 'ACCOUNT_DELETED' where o.id = ord.id;
    end if;
  end loop;

  -- Olive Stamps: one FORFEIT row for what is left. Coupon Points: one FORFEIT row per lot with points left
  -- (including a lot that ended but was not expired by the nightly job yet), so the balance projection reaches 0.
  select b.balance into v_stamps from public.stamp_balances b where b.user_id = p_user_id for update;
  if coalesce(v_stamps, 0) > 0 then
    perform private.add_stamp_tx(p_user_id, 'FORFEIT', -v_stamps, '탈퇴로 소멸', 'forfeit:' || p_user_id,
                                 null, null, p_user_id);
  end if;
  for r in
    select t.code_id, sum(t.delta)::integer as remaining
      from public.coupon_point_transactions t where t.user_id = p_user_id
     group by t.code_id having sum(t.delta) > 0
  loop
    perform private.add_point_tx(p_user_id, 'FORFEIT', -r.remaining, '탈퇴로 소멸', 'forfeit:' || p_user_id,
                                 r.code_id, null, p_user_id);
  end loop;
  update public.user_coupons c set status = 'VOID'
   where c.user_id = p_user_id and c.status in ('AVAILABLE', 'RESERVED');

  -- Personal data. Orders and payments stay (retention) but lose the free text a customer typed.
  update public.orders o set note = null where o.customer_id = p_user_id and o.note is not null;
  delete from public.notifications n where n.user_id = p_user_id;
  delete from public.notification_preferences np where np.user_id = p_user_id;
  update public.profiles x set nickname = '탈퇴한 회원', avatar_url = null, username = null where x.id = p_user_id;

  -- End the login: no identity, no password, no session, banned.
  delete from auth.identities i where i.user_id = p_user_id;
  delete from auth.sessions s where s.user_id = p_user_id;
  delete from auth.refresh_tokens t where t.user_id = p_user_id::text;
  delete from auth.mfa_factors m where m.user_id = p_user_id;
  update auth.users u set
    email = 'deleted-' || p_user_id || '@deleted.invalid',
    phone = null,
    encrypted_password = '',
    raw_user_meta_data = '{}'::jsonb,
    raw_app_meta_data = jsonb_build_object('provider', 'deleted', 'providers', jsonb_build_array()),
    banned_until = now() + interval '100 years',
    updated_at = now()
   where u.id = p_user_id;

  return jsonb_build_object('deleted', true, 'isReplay', false);
end;
$$;

-- Service role only (the Edge Function verifies the caller's JWT and passes that user's id).
create function public.delete_account(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.delete_account(p_user_id);
$$;

-- ===== grants =====
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_admin(), private.is_active_staff(), private.has_staff_permission(public.staff_permission),
  private.is_account_deleted()
to authenticated;

revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
