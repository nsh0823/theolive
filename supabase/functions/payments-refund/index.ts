// payments-refund: sends the refund the database already decided on (a rejected, cancelled or late-approved paid
// order) to the provider. The decision to refund is made by the order RPCs, never here; this function only
// executes it, so any signed-in user who can see the order may trigger the retry (it is idempotent).
import { adminClient, authenticate } from '../_shared/clients.ts';
import { HTTP, HttpError } from '../_shared/errors.ts';
import { jsonResponse, readJson, serveFunction } from '../_shared/http.ts';
import { getPaymentProvider } from '../_shared/payments/registry.ts';
import { executeRefund } from '../_shared/payments/settlement.ts';
import { refundRequestSchema } from '../_shared/validation/checkout.ts';

serveFunction('payments-refund', async (request) => {
  const { client } = await authenticate(request);
  const parsed = refundRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError('INVALID_INPUT');

  // Row-level security decides who may act on the order.
  const { data: order, error } = await client
    .from('orders')
    .select('id')
    .eq('id', parsed.data.orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new HttpError('NOT_FOUND');

  const admin = adminClient();
  const { data: refunds, error: refundsError } = await admin
    .from('refunds')
    .select('id, status, created_at, payments!inner(order_id)')
    .eq('payments.order_id', order.id)
    .order('created_at', { ascending: false });
  if (refundsError) throw refundsError;
  const latest = refunds?.[0];
  if (!latest) throw new HttpError('NOT_REFUNDABLE');

  const outcome = await executeRefund(admin, getPaymentProvider(admin), String(latest.id));
  if (outcome.refundStatus === 'FAILED') throw new HttpError('REFUND_FAILED');
  return jsonResponse(HTTP.OK, outcome);
});
