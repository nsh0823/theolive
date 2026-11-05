// payments-test-pg: the TEST payment sheet's backend. THIS IS NOT REAL PAYMENT. It plays the part of a payment
// gateway so every payment scenario can be exercised. It refuses unless PAYMENT_PROVIDER=TEST and
// ALLOW_TEST_PG=true, and it must never be enabled where real money moves.
import { adminClient, authenticate } from '../_shared/clients.ts';
import { HTTP, HttpError } from '../_shared/errors.ts';
import { jsonResponse, readJson, requireEnv, safeEqual, serveFunction } from '../_shared/http.ts';
import { readCheckoutToken, hmacHex } from '../_shared/payments/signature.ts';
import { TEST_SIGNATURE_HEADER } from '../_shared/payments/testProvider.ts';
import { testPgRequestSchema } from '../_shared/validation/checkout.ts';

type TestTransaction = { id: string; amount: number; status: string };
type Scenario = ReturnType<typeof testPgRequestSchema.parse>['scenario'];

async function postWebhook(secret: string, body: Record<string, unknown>): Promise<void> {
  const rawBody = JSON.stringify(body);
  const response = await fetch(`${requireEnv('SUPABASE_URL')}/functions/v1/payments-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [TEST_SIGNATURE_HEADER]: await hmacHex(secret, rawBody),
    },
    body: rawBody,
  });
  if (!response.ok) throw new Error(`Webhook delivery failed with ${response.status}`);
}

serveFunction('payments-test-pg', async (request) => {
  if (Deno.env.get('PAYMENT_PROVIDER') !== 'TEST' || Deno.env.get('ALLOW_TEST_PG') !== 'true') {
    throw new HttpError('TEST_PG_DISABLED');
  }
  await authenticate(request);
  const parsed = testPgRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError('INVALID_INPUT');
  const { checkoutToken, scenario } = parsed.data;

  const secret = requireEnv('PAYMENT_WEBHOOK_SECRET');
  const token = await readCheckoutToken(secret, checkoutToken, Date.now(), safeEqual);
  if (!token) throw new HttpError('FORBIDDEN');

  const admin = adminClient();
  const { data: existing, error } = await admin.rpc('test_pg_get', {
    p_payment_id: token.paymentId,
  });
  if (error) throw error;
  const txn = existing as TestTransaction | null;
  if (!txn) throw new HttpError('NOT_FOUND');
  // A sheet decides once; a repeated tap returns the earlier decision.
  if (txn.status !== 'PENDING') {
    return jsonResponse(HTTP.OK, decision(txn.status, txn.id));
  }

  const event = (type: string, amount: number | null, failureCode: string | null, suffix = '') => ({
    eventId: `evt-${txn.id}-${type}${suffix}`,
    type,
    paymentId: token.paymentId,
    providerPaymentId: txn.id,
    amount,
    failureCode,
  });

  const approve = async (approvedAmount: number, scenarioName: Scenario) => {
    const { error: setError } = await admin.rpc('test_pg_set', {
      p_payment_id: token.paymentId,
      p_status: 'APPROVED',
      p_scenario: scenarioName,
      p_approved_amount: approvedAmount,
    });
    if (setError) throw setError;
  };

  switch (scenario) {
    case 'SUCCESS':
      await approve(txn.amount, scenario);
      return jsonResponse(HTTP.OK, decision('APPROVED', txn.id));
    case 'SUCCESS_WEBHOOK_ONLY':
      // The customer's app "died" after approval: only the webhook ever reports it.
      await approve(txn.amount, scenario);
      await postWebhook(secret, event('PAYMENT_APPROVED', txn.amount, null));
      return jsonResponse(HTTP.OK, decision('APPROVED', null));
    case 'SUCCESS_DUPLICATE_WEBHOOK':
      await approve(txn.amount, scenario);
      await postWebhook(secret, event('PAYMENT_APPROVED', txn.amount, null));
      await postWebhook(secret, event('PAYMENT_APPROVED', txn.amount, null));
      return jsonResponse(HTTP.OK, decision('APPROVED', txn.id));
    case 'SUCCESS_LATE': {
      // The order's lifetime ends first, then the approval arrives.
      const { error: expireError } = await admin.rpc('test_pg_force_expire', {
        p_payment_id: token.paymentId,
      });
      if (expireError) throw expireError;
      await approve(txn.amount, scenario);
      await postWebhook(secret, event('PAYMENT_APPROVED', txn.amount, null));
      return jsonResponse(HTTP.OK, decision('APPROVED', txn.id));
    }
    case 'AMOUNT_MISMATCH':
      await approve(txn.amount - 1, scenario);
      return jsonResponse(HTTP.OK, decision('APPROVED', txn.id));
    case 'FAIL':
    case 'CANCEL': {
      const status = scenario === 'FAIL' ? 'FAILED' : 'CANCELLED';
      const { error: setError } = await admin.rpc('test_pg_set', {
        p_payment_id: token.paymentId,
        p_status: status,
        p_scenario: scenario,
      });
      if (setError) throw setError;
      await postWebhook(
        secret,
        event(scenario === 'FAIL' ? 'PAYMENT_FAILED' : 'PAYMENT_CANCELLED', null, status),
      );
      return jsonResponse(HTTP.OK, decision(status, null));
    }
  }
});

function decision(status: string, providerPaymentKey: string | null) {
  const result =
    status === 'APPROVED' || status === 'REFUNDED'
      ? 'APPROVED'
      : status === 'CANCELLED'
        ? 'CANCELLED'
        : 'FAILED';
  return { result, providerPaymentKey };
}
