import type { CheckoutInput } from '@theolive/api';

import type { CartLine, OrderType, PaymentMethod } from '@/models';

/** Identifies the contents of a checkout request: same contents keep the same idempotency key. */
export function checkoutFingerprint(
  lines: CartLine[],
  orderType: OrderType,
  method: PaymentMethod,
  userCouponId: string | null = null,
  pointsToUse = 0,
): string {
  const parts = lines.map(
    (line) => `${line.menuItemId}:${line.temperature ?? '-'}:${line.quantity}`,
  );
  return [orderType, method, userCouponId ?? '-', String(pointsToUse), ...parts].join('|');
}

/**
 * Builds the `payments-checkout` body. It carries ids, temperature and quantity only: the server prices
 * every order and computes the coupon discount; `pointsToUse` is the amount the server quote returned.
 */
export function toCheckoutInput(args: {
  clientRequestId: string;
  lines: CartLine[];
  orderType: OrderType;
  method: PaymentMethod;
  userCouponId?: string | null;
  pointsToUse?: number;
}): CheckoutInput {
  return {
    clientRequestId: args.clientRequestId,
    orderType: args.orderType,
    lines: args.lines.map((line) => ({
      menuItemId: line.menuItemId,
      temperature: line.temperature,
      quantity: line.quantity,
    })),
    userCouponId: args.userCouponId ?? null,
    pointsToUse: args.pointsToUse ?? 0,
    paymentMethod: args.method,
    note: null,
  };
}
