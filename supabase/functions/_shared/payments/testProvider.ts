import { z } from 'zod';

import { HttpError } from '../errors.ts';
import { safeEqual } from '../http.ts';
import type { AnySupabaseClient } from '../clients.ts';
import type {
  NextAction,
  PaymentProvider,
  ProviderResult,
  RefundResult,
  WebhookEvent,
} from './provider.ts';
import { createCheckoutToken, hmacHex } from './signature.ts';

export const TEST_PROVIDER_ID = 'TEST';
export const TEST_SIGNATURE_HEADER = 'x-test-pg-signature';
const CHECKOUT_TOKEN_TTL_MS = 20 * 60 * 1000;

const transactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  approved_amount: z.number().nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'FAILED', 'CANCELLED', 'REFUNDED']),
});
type Transaction = z.infer<typeof transactionSchema>;

const webhookBodySchema = z.object({
  eventId: z.string().min(1),
  type: z.enum(['PAYMENT_APPROVED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED']),
  paymentId: z.uuid(),
  providerPaymentId: z.string().nullable(),
  amount: z.number().nullable(),
  failureCode: z.string().nullable(),
});

const OUTCOME_BY_TYPE = {
  PAYMENT_APPROVED: 'APPROVED',
  PAYMENT_FAILED: 'FAILED',
  PAYMENT_CANCELLED: 'CANCELLED',
} as const;

/**
 * Stand-in payment gateway for development and automated tests. It keeps its own "database"
 * (test_pg.transactions) so lookups, webhooks and refunds behave like a real provider. NOT real payment.
 */
export class TestPaymentProvider implements PaymentProvider {
  readonly id = TEST_PROVIDER_ID;

  constructor(
    private readonly admin: AnySupabaseClient,
    private readonly webhookSecret: string,
    private readonly now: () => number = Date.now,
  ) {}

  private async transaction(paymentId: string): Promise<Transaction | null> {
    const { data, error } = await this.admin.rpc('test_pg_get', { p_payment_id: paymentId });
    if (error) throw error;
    return data ? transactionSchema.parse(data) : null;
  }

  async prepare(input: { paymentId: string; amount: number }): Promise<NextAction> {
    const { error } = await this.admin.rpc('test_pg_create', {
      p_payment_id: input.paymentId,
      p_amount: input.amount,
    });
    if (error) throw error;
    const checkoutToken = await createCheckoutToken(
      this.webhookSecret,
      input.paymentId,
      this.now() + CHECKOUT_TOKEN_TTL_MS,
    );
    return { type: 'TEST_SHEET', checkoutToken };
  }

  private toResult(txn: Transaction | null): ProviderResult {
    if (!txn || txn.status === 'PENDING') {
      return { status: 'PENDING', providerPaymentId: null, amount: null, failureCode: null };
    }
    if (txn.status === 'FAILED' || txn.status === 'CANCELLED') {
      return {
        status: txn.status,
        providerPaymentId: txn.id,
        amount: null,
        failureCode: txn.status,
      };
    }
    // APPROVED, or REFUNDED after having been approved.
    return {
      status: 'APPROVED',
      providerPaymentId: txn.id,
      amount: txn.approved_amount ?? txn.amount,
      failureCode: null,
    };
  }

  async verifyApproval(input: {
    paymentId: string;
    providerPaymentKey: string;
  }): Promise<ProviderResult> {
    const txn = await this.transaction(input.paymentId);
    // The key must be the provider's own transaction id; anything else is not an approval.
    if (!txn || txn.id !== input.providerPaymentKey) {
      return { status: 'PENDING', providerPaymentId: null, amount: null, failureCode: null };
    }
    return this.toResult(txn);
  }

  async lookup(input: { paymentId: string }): Promise<ProviderResult> {
    return this.toResult(await this.transaction(input.paymentId));
  }

  async parseWebhook(request: Request): Promise<WebhookEvent> {
    const rawBody = await request.text();
    const signature = request.headers.get(TEST_SIGNATURE_HEADER) ?? '';
    if (!safeEqual(await hmacHex(this.webhookSecret, rawBody), signature)) {
      throw new HttpError('WEBHOOK_SIGNATURE_INVALID');
    }
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch (error) {
      console.error('Webhook body is not JSON', error);
      throw new HttpError('INVALID_INPUT');
    }
    const parsed = webhookBodySchema.safeParse(json);
    if (!parsed.success) throw new HttpError('INVALID_INPUT');
    const body = parsed.data;
    return {
      eventId: body.eventId,
      outcome: OUTCOME_BY_TYPE[body.type],
      paymentId: body.paymentId,
      providerPaymentId: body.providerPaymentId,
      amount: body.amount,
      failureCode: body.failureCode,
      payload: { type: body.type, amount: body.amount, failureCode: body.failureCode },
    };
  }

  async refund(input: {
    providerPaymentId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    const { data, error } = await this.admin.rpc('test_pg_refund', {
      p_provider_payment_id: input.providerPaymentId,
      p_amount: input.amount,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) throw error;
    const result = z
      .object({
        status: z.enum(['SUCCEEDED', 'FAILED']),
        providerRefundId: z.string().optional(),
        message: z.string().optional(),
      })
      .parse(data);
    return result.status === 'SUCCEEDED'
      ? { status: 'SUCCEEDED', providerRefundId: result.providerRefundId ?? input.idempotencyKey }
      : { status: 'FAILED', message: result.message ?? 'REFUND_FAILED' };
  }
}
