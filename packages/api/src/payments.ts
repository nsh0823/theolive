import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Temperature,
  TestPgScenario,
} from '@theolive/types';
import { toAppErrorCode } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { AppError, parseFunctionError } from './functionErrors';
import { queryKeys } from './query-keys';
import { asRecord, toOrderStatus, toPaymentStatus } from './statusGuards';

export type CheckoutLineInput = {
  menuItemId: string;
  temperature: Temperature | null;
  quantity: number;
};

/** Body of `payments-checkout`. There are no prices: the server prices every order from the menu. */
export type CheckoutInput = {
  /** One id per checkout attempt; reuse it for retries so a double tap cannot create two orders. */
  clientRequestId: string;
  orderType: OrderType;
  lines: CheckoutLineInput[];
  /** An AVAILABLE coupon of the signed-in customer, or null. The server validates it and computes the discount. */
  userCouponId: string | null;
  /** Coupon Points to spend, in won. Use the amount the server quote returned; the server re-checks it. */
  pointsToUse: number;
  paymentMethod: Exclude<PaymentMethod, 'NONE'>;
  note: string | null;
};

export type NextAction =
  | { type: 'TEST_SHEET'; checkoutToken: string }
  | { type: 'REDIRECT'; url: string }
  | { type: 'NONE' };

export type CheckoutResult = {
  orderId: string;
  paymentId: string;
  /** Amount to pay, after the coupon. */
  amount: number;
  /** The server's breakdown, shown as is (the app never computes a discount). */
  menuAmount: number;
  couponDiscount: number;
  pointsUsed: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  orderNumber: string | null;
  isReplay: boolean;
  nextAction: NextAction;
};

export type PaymentStatusResult = {
  paymentId: string;
  orderId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  orderNumber: string | null;
  expiresAt: string;
};

async function invokeFunction(
  client: Pick<TypedSupabaseClient, 'functions'>,
  name: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await client.functions.invoke<unknown>(name, { body });
  if (error) throw new AppError(await parseFunctionError(error));
  return asRecord(data);
}

function parseNextAction(value: unknown): NextAction {
  const action = asRecord(value);
  if (action.type === 'TEST_SHEET' && typeof action.checkoutToken === 'string') {
    return { type: 'TEST_SHEET', checkoutToken: action.checkoutToken };
  }
  if (action.type === 'REDIRECT' && typeof action.url === 'string') {
    return { type: 'REDIRECT', url: action.url };
  }
  return { type: 'NONE' };
}

export async function createCheckout(
  client: Pick<TypedSupabaseClient, 'functions'>,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const body = await invokeFunction(client, 'payments-checkout', { ...input });
  return {
    orderId: String(body.orderId),
    paymentId: String(body.paymentId),
    amount: Number(body.amount),
    menuAmount: Number(body.menuAmount),
    couponDiscount: Number(body.couponDiscount),
    pointsUsed: Number(body.pointsUsed),
    status: toOrderStatus(body.status),
    paymentStatus: toPaymentStatus(body.paymentStatus),
    orderNumber: typeof body.orderNumber === 'string' ? body.orderNumber : null,
    isReplay: body.isReplay === true,
    nextAction: parseNextAction(body.nextAction),
  };
}

export function toPaymentStatusResult(body: Record<string, unknown>): PaymentStatusResult {
  return {
    paymentId: String(body.paymentId),
    orderId: String(body.orderId),
    orderStatus: toOrderStatus(body.orderStatus),
    paymentStatus: toPaymentStatus(body.paymentStatus),
    orderNumber: typeof body.orderNumber === 'string' ? body.orderNumber : null,
    expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '',
  };
}

/** Tells the server the customer finished the provider's step. The server verifies it with the provider. */
export async function confirmPayment(
  client: Pick<TypedSupabaseClient, 'functions'>,
  input: { paymentId: string; providerPaymentKey: string },
) {
  const body = await invokeFunction(client, 'payments-confirm', { ...input });
  return {
    orderId: String(body.orderId),
    orderStatus: toOrderStatus(body.orderStatus),
    paymentStatus: toPaymentStatus(body.paymentStatus),
    orderNumber: typeof body.orderNumber === 'string' ? body.orderNumber : null,
  };
}

/** Server truth for a payment; also the recovery path after the app was killed mid-payment. */
export async function fetchPaymentStatus(
  client: Pick<TypedSupabaseClient, 'functions'>,
  target: { paymentId: string } | { orderId: string },
): Promise<PaymentStatusResult> {
  return toPaymentStatusResult(await invokeFunction(client, 'payments-status', { ...target }));
}

export type TestPaymentDecision = {
  result: 'APPROVED' | 'FAILED' | 'CANCELLED';
  providerPaymentKey: string | null;
};

/** TEST gateway only (never real payment). Refused by the server unless ALLOW_TEST_PG is on. */
export async function runTestPayment(
  client: Pick<TypedSupabaseClient, 'functions'>,
  input: { checkoutToken: string; scenario: TestPgScenario },
): Promise<TestPaymentDecision> {
  const body = await invokeFunction(client, 'payments-test-pg', { ...input });
  const result = body.result;
  if (result !== 'APPROVED' && result !== 'FAILED' && result !== 'CANCELLED') {
    throw new AppError(toAppErrorCode(null));
  }
  return {
    result,
    providerPaymentKey:
      typeof body.providerPaymentKey === 'string' ? body.providerPaymentKey : null,
  };
}

/** Sends the refund the database already requested for this order to the provider. */
export async function requestRefundExecution(
  client: Pick<TypedSupabaseClient, 'functions'>,
  orderId: string,
): Promise<void> {
  await invokeFunction(client, 'payments-refund', { orderId });
}

export function useCreateCheckout(client: TypedSupabaseClient) {
  return useMutation({ mutationFn: (input: CheckoutInput) => createCheckout(client, input) });
}

export function useConfirmPayment(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { paymentId: string; providerPaymentKey: string }) =>
      confirmPayment(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}

export function useRunTestPayment(client: TypedSupabaseClient) {
  return useMutation({
    mutationFn: (input: { checkoutToken: string; scenario: TestPgScenario }) =>
      runTestPayment(client, input),
  });
}

/** Polls the server for the payment of an order until it is settled, so a killed app still ends up correct. */
export const PAYMENT_STATUS_POLL_MS = 3_000;

export function usePaymentStatus(client: TypedSupabaseClient, orderId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payments.status(orderId),
    queryFn: () => fetchPaymentStatus(client, { orderId }),
    enabled: enabled && orderId !== '',
    refetchInterval: (query) => {
      return query.state.data?.paymentStatus === 'READY' ? PAYMENT_STATUS_POLL_MS : false;
    },
  });
}
