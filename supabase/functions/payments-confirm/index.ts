// payments-confirm: the app reports that the customer finished paying. The report is NOT proof: the provider is
// asked directly (verifyApproval) and only its answer, with the amount checked against the payment, can mark the
// order paid. Safe to call twice and safe to race with the webhook.
import { adminClient, authenticate } from '../_shared/clients.ts';
import { HTTP, HttpError } from '../_shared/errors.ts';
import { jsonResponse, readJson, serveFunction } from '../_shared/http.ts';
import { getPaymentProvider } from '../_shared/payments/registry.ts';
import { applyPaymentResult, runFollowUp } from '../_shared/payments/settlement.ts';
import { paymentConfirmRequestSchema } from '../_shared/validation/checkout.ts';

serveFunction('payments-confirm', async (request) => {
  const { client } = await authenticate(request);
  const parsed = paymentConfirmRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError('INVALID_INPUT');
  const { paymentId, providerPaymentKey } = parsed.data;

  // Row-level security: only the owner of the order can see its payment.
  const { data: payment, error } = await client
    .from('payments')
    .select('id, amount')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment) throw new HttpError('NOT_FOUND');

  const admin = adminClient();
  const provider = getPaymentProvider(admin);
  const verified = await provider.verifyApproval({
    paymentId,
    providerPaymentKey,
    expectedAmount: Number(payment.amount),
  });

  if (verified.status !== 'APPROVED') {
    if (verified.status !== 'PENDING') {
      await applyPaymentResult(admin, {
        paymentId,
        outcome: verified.status,
        providerPaymentId: verified.providerPaymentId,
        amount: verified.amount,
        eventId: `confirm:${paymentId}:${verified.status}`,
        source: 'CONFIRM',
        failureCode: verified.failureCode,
      });
    }
    throw new HttpError('PAYMENT_NOT_APPROVED');
  }

  // An approval without the provider's own payment id cannot be traced or refunded: not proof of payment.
  if (!verified.providerPaymentId?.trim()) throw new HttpError('PAYMENT_NOT_APPROVED');

  const summary = await applyPaymentResult(admin, {
    paymentId,
    outcome: 'APPROVED',
    providerPaymentId: verified.providerPaymentId,
    amount: verified.amount,
    eventId: `confirm:${paymentId}:${verified.providerPaymentId ?? 'none'}`,
    source: 'CONFIRM',
  });
  await runFollowUp(admin, provider, summary);

  if (summary.cancelAtProvider) throw new HttpError('PAYMENT_AMOUNT_MISMATCH');
  if (summary.orderStatus === 'CANCELLED') {
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('cancel_reason')
      .eq('id', summary.orderId)
      .single();
    if (orderError) throw orderError;
    if (order.cancel_reason === 'EXPIRED') throw new HttpError('PAYMENT_EXPIRED');
  }

  return jsonResponse(HTTP.OK, {
    orderId: summary.orderId,
    orderStatus: summary.orderStatus,
    paymentStatus: summary.paymentStatus,
    orderNumber: summary.orderNumber,
  });
});
