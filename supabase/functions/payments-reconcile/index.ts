// payments-reconcile: the safety net behind webhooks and the app. Called by pg_cron (through pg_net) with the
// service-role key. It (1) asks the provider about payments still READY after a few minutes and applies the
// answer, (2) expires unpaid orders past their lifetime, (3) retries refunds that were requested or failed.
import { adminClient } from '../_shared/clients.ts';
import { HTTP, HttpError } from '../_shared/errors.ts';
import { jsonResponse, requireEnv, safeEqual, serveFunction } from '../_shared/http.ts';
import { getPaymentProvider } from '../_shared/payments/registry.ts';
import {
  applyLookup,
  executeProviderCancel,
  executeRefund,
} from '../_shared/payments/settlement.ts';

const CHECK_AFTER_MS = 5 * 60 * 1000;
const BATCH_LIMIT = 100;
// How long after a payment was cancelled (expired / customer cancel) the provider is still asked about it, so an
// approval whose webhook was lost is found and refunded.
const LATE_APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

serveFunction('payments-reconcile', async (request) => {
  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (!safeEqual(bearer, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))) throw new HttpError('FORBIDDEN');

  const admin = adminClient();
  const provider = getPaymentProvider(admin);
  const cutoff = new Date(Date.now() - CHECK_AFTER_MS).toISOString();

  const { data: open, error: openError } = await admin
    .from('payments')
    .select('id')
    .eq('status', 'READY')
    .lt('requested_at', cutoff)
    .order('requested_at')
    .limit(BATCH_LIMIT);
  if (openError) throw openError;

  const lateCutoff = new Date(Date.now() - LATE_APPROVAL_WINDOW_MS).toISOString();
  const { data: cancelled, error: cancelledError } = await admin
    .from('payments')
    .select('id')
    .eq('status', 'CANCELLED')
    .in('failure_code', ['EXPIRED', 'CUSTOMER_CANCELLED'])
    .gt('cancelled_at', lateCutoff)
    .order('cancelled_at', { ascending: false })
    .limit(BATCH_LIMIT);
  if (cancelledError) throw cancelledError;

  let applied = 0;
  for (const payment of [...(open ?? []), ...(cancelled ?? [])]) {
    try {
      const result = await provider.lookup({ paymentId: String(payment.id) });
      if (await applyLookup(admin, provider, String(payment.id), result, 'RECONCILE')) applied += 1;
    } catch (error) {
      console.error('Reconcile lookup failed', payment.id, error);
    }
  }

  const { data: expired, error: expireError } = await admin.rpc('expire_stale_orders');
  if (expireError) throw expireError;

  const { data: pending, error: pendingError } = await admin
    .from('refunds')
    .select('id')
    .in('status', ['REQUESTED', 'FAILED'])
    .order('created_at')
    .limit(BATCH_LIMIT);
  if (pendingError) throw pendingError;
  let refundsRetried = 0;
  for (const refund of pending ?? []) {
    try {
      await executeRefund(admin, provider, String(refund.id));
      refundsRetried += 1;
    } catch (error) {
      console.error('Reconcile refund failed', refund.id, error);
    }
  }

  const { data: owedCancels, error: cancelsError } = await admin
    .from('provider_cancels')
    .select('payment_id')
    .in('status', ['REQUESTED', 'FAILED'])
    .order('created_at')
    .limit(BATCH_LIMIT);
  if (cancelsError) throw cancelsError;
  let cancelsRetried = 0;
  for (const owed of owedCancels ?? []) {
    try {
      if (await executeProviderCancel(admin, provider, String(owed.payment_id)))
        cancelsRetried += 1;
    } catch (error) {
      console.error('Reconcile provider cancel failed', owed.payment_id, error);
    }
  }

  return jsonResponse(HTTP.OK, {
    cancelsRetried,
    checked: (open?.length ?? 0) + (cancelled?.length ?? 0),
    applied,
    expired: Number(expired ?? 0),
    refundsRetried,
  });
});
