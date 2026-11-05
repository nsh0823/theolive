// payments-webhook: the provider tells us a payment changed. No Supabase session exists here; the request is
// trusted only if its HMAC signature verifies. After that the answer is always 200 for a handled event
// (duplicates and unknown payments included) so the provider stops retrying; a bad signature is 401 and changes
// nothing, a server fault is 500 so the provider retries.
import { adminClient } from '../_shared/clients.ts';
import { HTTP } from '../_shared/errors.ts';
import { jsonResponse, serveFunction } from '../_shared/http.ts';
import { getPaymentProvider } from '../_shared/payments/registry.ts';
import { applyPaymentResult, runFollowUp } from '../_shared/payments/settlement.ts';

serveFunction('payments-webhook', async (request) => {
  const admin = adminClient();
  const provider = getPaymentProvider(admin);
  const event = await provider.parseWebhook(request);

  try {
    const summary = await applyPaymentResult(admin, {
      paymentId: event.paymentId,
      outcome: event.outcome,
      providerPaymentId: event.providerPaymentId,
      amount: event.amount,
      eventId: event.eventId,
      source: 'WEBHOOK',
      payload: event.payload,
      failureCode: event.failureCode,
    });
    await runFollowUp(admin, provider, summary);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      error.message === 'NOT_FOUND'
    ) {
      console.error('Webhook for an unknown payment', event.paymentId);
      return jsonResponse(HTTP.OK, { received: true });
    }
    throw error;
  }
  return jsonResponse(HTTP.OK, { received: true });
});
