// Provider boundary (plan section 3.4). Everything the payment functions need from a payment gateway goes through
// this interface, so swapping the TEST adapter for a real gateway with a hosted payment page changes no client.

export type PaymentMethod = 'KAKAO_PAY' | 'NAVER_PAY' | 'TOSS_PAY' | 'CARD' | 'NONE';

export type NextAction =
  | { type: 'REDIRECT'; url: string }
  | { type: 'TEST_SHEET'; checkoutToken: string }
  | { type: 'NONE' };

export type ProviderResult = {
  status: 'APPROVED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  providerPaymentId: string | null;
  amount: number | null;
  failureCode: string | null;
};

export type WebhookEvent = {
  eventId: string;
  outcome: 'APPROVED' | 'FAILED' | 'CANCELLED';
  paymentId: string;
  providerPaymentId: string | null;
  amount: number | null;
  failureCode: string | null;
  /** Provider payload with card and personal fields removed; stored in payment_events. */
  payload: Record<string, unknown>;
};

export type RefundResult =
  { status: 'SUCCEEDED'; providerRefundId: string } | { status: 'FAILED'; message: string };

export interface PaymentProvider {
  readonly id: string;
  prepare(input: {
    paymentId: string;
    amount: number;
    orderName: string;
    method: PaymentMethod;
    returnUrl: string;
  }): Promise<NextAction>;
  verifyApproval(input: {
    paymentId: string;
    providerPaymentKey: string;
    expectedAmount: number;
  }): Promise<ProviderResult>;
  /** Recovery and reconciliation: ask the provider what it knows about a payment. */
  lookup(input: { paymentId: string }): Promise<ProviderResult>;
  /** Verifies the signature and returns the event. Throws HttpError('WEBHOOK_SIGNATURE_INVALID') when it is wrong. */
  parseWebhook(request: Request): Promise<WebhookEvent>;
  refund(input: {
    providerPaymentId: string;
    amount: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<RefundResult>;
}
