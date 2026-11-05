-- Phase (c) scheduled jobs (approved for local use, OQ-38): pg_cron expires unpaid orders every minute and asks
-- the payments-reconcile Edge Function (through pg_net) to check open payments and retry refunds every 5 minutes.
-- The Edge Function URL and service key live in Vault (names: functions_base_url, service_role_key), set by the
-- operator; local development sets them in supabase/seed.sql. Without them the reconcile call is skipped.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function private.call_payments_reconcile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select ds.decrypted_secret into v_url from vault.decrypted_secrets ds where ds.name = 'functions_base_url';
  select ds.decrypted_secret into v_key from vault.decrypted_secrets ds where ds.name = 'service_role_key';
  if v_url is null or v_key is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/payments-reconcile',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb
  );
end;
$$;

select cron.schedule('expire-stale-orders', '* * * * *', $$select private.expire_stale_orders()$$);
select cron.schedule('payments-reconcile', '*/5 * * * *', $$select private.call_payments_reconcile()$$);
