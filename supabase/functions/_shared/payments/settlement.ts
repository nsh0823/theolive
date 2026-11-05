import { z } from 'zod';

import type { AnySupabaseClient } from '../clients.ts';
import type { PaymentProvider, ProviderResult } from './provider.ts';

// The only place Edge Functions change payment state: every result goes through the SQL function
// apply_payment_result (idempotent), then any provider-side follow-up (refund, cancel) runs here.

const summarySchema = z.object({
  result: z.enum(['APPLIED', 'DUPLICATE', 'REJECTED']),
  paymentId: z.string(),
  orderId: z.string(),
  orderStatus: z.string(),
  paymentStatus: z.string(),
  orderNumber: z.string().nullable(),
  amount: z.number(),
  providerPaymentId: z.string().nullable(),
  refundId: z.string().nullable(),
  cancelAtProvider: z.boolean(),
});
export type PaymentSummary = z.infer<typeof summarySchema>;

export type ApplyInput = {
  paymentId: string;
  outcome: 'APPROVED' | 'FAILED' | 'CANCELLED';
  providerPaymentId: string | null;
  amount: number | null;
  eventId: string;
  source: 'CONFIRM' | 'WEBHOOK' | 'STATUS' | 'RECONCILE';
  payload?: Record<string, unknown> | null;
  failureCode?: string | null;
};

export async function applyPaymentResult(
  admin: AnySupabaseClient,
  input: ApplyInput,
): Promise<PaymentSummary> {
  const { data, error } = await admin.rpc('apply_payment_result', {
    p_payment_id: input.paymentId,
    p_outcome: input.outcome,
    p_provider_payment_id: input.providerPaymentId,
    p_amount: input.amount,
    p_event_id: input.eventId,
    p_source: input.source,
    p_payload: input.payload ?? null,
    p_failure_code: input.failureCode ?? null,
  });
  if (error) throw error;
  return summarySchema.parse(data);
}

const refundRowSchema = z.object({
  id: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: z.enum(['REQUESTED', 'SUCCEEDED', 'FAILED']),
  idempotency_key: z.string(),
  payments: z.object({ provider_payment_id: z.string().nullable(), status: z.string() }),
});

export type RefundOutcome = { refundId: string; refundStatus: string; paymentStatus: string };

/** Sends one refund to the provider and records the answer. Safe to repeat: the provider call is keyed. */
export async function executeRefund(
  admin: AnySupabaseClient,
  provider: PaymentProvider,
  refundId: string,
): Promise<RefundOutcome> {
  const { data, error } = await admin
    .from('refunds')
    .select('id, amount, reason, status, idempotency_key, payments(provider_payment_id, status)')
    .eq('id', refundId)
    .single();
  if (error) throw error;
  const refund = refundRowSchema.parse(data);
  if (refund.status === 'SUCCEEDED') {
    return { refundId, refundStatus: refund.status, paymentStatus: refund.payments.status };
  }
  const providerPaymentId = refund.payments.provider_payment_id;
  const result = providerPaymentId
    ? await provider.refund({
        providerPaymentId,
        amount: refund.amount,
        idempotencyKey: refund.idempotency_key,
        reason: refund.reason,
      })
    : ({ status: 'FAILED', message: 'NO_PROVIDER_PAYMENT_ID' } as const);
  const { data: recorded, error: recordError } = await admin.rpc('record_refund_result', {
    p_refund_id: refundId,
    p_succeeded: result.status === 'SUCCEEDED',
    p_provider_refund_id: result.status === 'SUCCEEDED' ? result.providerRefundId : null,
    p_message: result.status === 'FAILED' ? result.message : null,
  });
  if (recordError) throw recordError;
  const outcome = z.object({ refundStatus: z.string(), paymentStatus: z.string() }).parse(recorded);
  return { refundId, ...outcome };
}

/**
 * Runs what the database decided must happen at the provider: the automatic refund of a late approval, or
 * the cancel of an approval whose amount did not match. Failures stay recorded for the reconcile retry.
 */
export async function runFollowUp(
  admin: AnySupabaseClient,
  provider: PaymentProvider,
  summary: PaymentSummary,
): Promise<void> {
  if (summary.refundId) {
    try {
      await executeRefund(admin, provider, summary.refundId);
    } catch (error) {
      console.error('Automatic refund failed; reconcile will retry', summary.refundId, error);
    }
  }
  if (summary.cancelAtProvider) {
    try {
      await executeProviderCancel(admin, provider, summary.paymentId);
    } catch (error) {
      console.error(
        'Provider cancel after amount mismatch failed; reconcile will retry',
        summary.paymentId,
        error,
      );
    }
  }
}

const providerCancelRowSchema = z.object({
  payment_id: z.string(),
  provider_payment_id: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: z.enum(['REQUESTED', 'SUCCEEDED', 'FAILED']),
  attempts: z.number(),
});

/**
 * Sends the owed provider-side cancel (row written by apply_payment_result) and records the answer. The row
 * stays REQUESTED / FAILED until the provider confirms, so reconcile keeps retrying. The provider call is keyed
 * `cancel:<paymentId>`, so repeating it never cancels twice.
 */
export async function executeProviderCancel(
  admin: AnySupabaseClient,
  provider: PaymentProvider,
  paymentId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('provider_cancels')
    .select('payment_id, provider_payment_id, amount, reason, status, attempts')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const cancel = providerCancelRowSchema.parse(data);
  if (cancel.status === 'SUCCEEDED') return true;
  const result = await provider.refund({
    providerPaymentId: cancel.provider_payment_id,
    amount: cancel.amount,
    idempotencyKey: `cancel:${paymentId}`,
    reason: cancel.reason,
  });
  const succeeded = result.status === 'SUCCEEDED';
  const { error: updateError } = await admin
    .from('provider_cancels')
    .update({
      status: succeeded ? 'SUCCEEDED' : 'FAILED',
      attempts: cancel.attempts + 1,
      failure_message: result.status === 'FAILED' ? result.message.slice(0, 200) : null,
      completed_at: succeeded ? new Date().toISOString() : null,
    })
    .eq('payment_id', paymentId)
    .neq('status', 'SUCCEEDED');
  if (updateError) throw updateError;
  return succeeded;
}

/** Applies a provider answer from a lookup (status polling, reconcile). PENDING answers change nothing. */
export async function applyLookup(
  admin: AnySupabaseClient,
  provider: PaymentProvider,
  paymentId: string,
  result: ProviderResult,
  source: 'STATUS' | 'RECONCILE',
): Promise<PaymentSummary | null> {
  if (result.status === 'PENDING') return null;
  const summary = await applyPaymentResult(admin, {
    paymentId,
    outcome: result.status,
    providerPaymentId: result.providerPaymentId,
    amount: result.amount,
    eventId: `${source.toLowerCase()}:${paymentId}:${result.status}:${result.providerPaymentId ?? 'none'}`,
    source,
    failureCode: result.failureCode,
  });
  await runFollowUp(admin, provider, summary);
  return summary;
}
