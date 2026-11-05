import { MS_PER_MINUTE } from '@/lib/time';
import { ORDER_STATUS, PAYMENT_STATUS, type Order } from './models';

/** A refund still not done this long after the order was rejected or cancelled needs someone to look at it. */
export const REFUND_CHECK_AFTER_MS = 10 * MS_PER_MINUTE;

export const REFUND_STATE = {
  IN_PROGRESS: '환불 진행 중',
  DONE: '환불 완료',
  NEEDS_CHECK: '환불 확인 필요',
} as const;
export type RefundState = (typeof REFUND_STATE)[keyof typeof REFUND_STATE];

/**
 * Refund text for an order that ended without being served, derived from the payment status the server keeps.
 * The clock starts when the order was rejected or cancelled.
 */
export function describeRefund(order: Order, nowMs: number): RefundState | null {
  const isUnserved =
    order.status === ORDER_STATUS.CANCELLED || order.status === ORDER_STATUS.REJECTED;
  if (!isUnserved) return null;
  if (order.paymentStatus === PAYMENT_STATUS.REFUNDED) return REFUND_STATE.DONE;
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) return null;
  const waitedMs = nowMs - new Date(order.endedAt ?? order.placedAt).getTime();
  return waitedMs > REFUND_CHECK_AFTER_MS ? REFUND_STATE.NEEDS_CHECK : REFUND_STATE.IN_PROGRESS;
}
