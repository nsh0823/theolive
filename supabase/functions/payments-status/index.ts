// payments-status: what the server knows about a payment/order. This is the recovery path when the app was killed
// or lost its connection mid-payment: if the payment is still READY after a short wait, the provider is asked
// (lookup) and its answer is applied, exactly like a webhook would.
import { adminClient, authenticate } from '../_shared/clients.ts';
import { HTTP, HttpError } from '../_shared/errors.ts';
import { jsonResponse, readJson, serveFunction } from '../_shared/http.ts';
import { getPaymentProvider } from '../_shared/payments/registry.ts';
import { applyLookup } from '../_shared/payments/settlement.ts';
import { paymentStatusRequestSchema } from '../_shared/validation/checkout.ts';

const LOOKUP_AFTER_MS = 30 * 1000;
// Same bound as payments-reconcile: how long a cancelled payment is still checked for a late approval.
const LATE_APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const CANCELLED_BEFORE_APPROVAL = ['EXPIRED', 'CUSTOMER_CANCELLED'];

serveFunction('payments-status', async (request) => {
  const { client } = await authenticate(request);
  const parsed = paymentStatusRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError('INVALID_INPUT');

  // Reads go through the caller's client, so only the owner (or staff who may see the order) gets an answer.
  const query = client
    .from('payments')
    .select('id, order_id, status, requested_at, cancelled_at')
    .order('requested_at', { ascending: false })
    .limit(1);
  const { data: rows, error } = await ('paymentId' in parsed.data
    ? query.eq('id', parsed.data.paymentId)
    : query.eq('order_id', parsed.data.orderId));
  if (error) throw error;
  const payment = rows?.[0];
  if (!payment) throw new HttpError('NOT_FOUND');

  const admin = adminClient();
  const isOldEnough =
    Date.now() - new Date(String(payment.requested_at)).getTime() > LOOKUP_AFTER_MS;
  if (payment.status === 'READY' && isOldEnough) {
    const provider = getPaymentProvider(admin);
    const result = await provider.lookup({ paymentId: String(payment.id) });
    const applied = await applyLookup(admin, provider, String(payment.id), result, 'STATUS');
    if (!applied) {
      // The provider has no result and the order's lifetime is over: close it so the customer is not stuck.
      const { error: expireError } = await admin.rpc('expire_stale_orders');
      if (expireError) throw expireError;
    }
  }

  if (payment.status === 'CANCELLED' && payment.cancelled_at) {
    // failure_code is hidden from clients; the ownership check above already passed, so read it as the server.
    const { data: detail, error: detailError } = await admin
      .from('payments')
      .select('failure_code')
      .eq('id', payment.id)
      .single();
    if (detailError) throw detailError;
    const withinWindow =
      Date.now() - new Date(String(payment.cancelled_at)).getTime() < LATE_APPROVAL_WINDOW_MS;
    if (withinWindow && CANCELLED_BEFORE_APPROVAL.includes(String(detail.failure_code))) {
      const provider = getPaymentProvider(admin);
      const result = await provider.lookup({ paymentId: String(payment.id) });
      await applyLookup(admin, provider, String(payment.id), result, 'STATUS');
    }
  }

  const { data: order, error: orderError } = await client
    .from('orders')
    .select('id, status, payment_status, order_number, expires_at')
    .eq('id', payment.order_id)
    .single();
  if (orderError) throw orderError;
  return jsonResponse(HTTP.OK, {
    paymentId: payment.id,
    orderId: order.id,
    orderStatus: order.status,
    paymentStatus: order.payment_status,
    orderNumber: order.order_number,
    expiresAt: order.expires_at,
  });
});
