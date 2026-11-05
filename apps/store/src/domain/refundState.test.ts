import { describe, expect, it } from 'vitest';
import { createOrders } from '@/test/orderFactory';
import { MS_PER_MINUTE } from '@/lib/time';
import { ORDER_STATUS, PAYMENT_STATUS, type Order } from './models';
import { describeRefund, REFUND_STATE } from './refundState';

const NOW = Date.now();
const [first] = createOrders(NOW);
if (!first) throw new Error('fixture orders missing');
const base: Order = first;

function order(patch: Partial<Order>): Order {
  const fresh: Order = { ...base, placedAt: new Date(NOW - MS_PER_MINUTE).toISOString() };
  return Object.assign(fresh, patch);
}

describe('describeRefund', () => {
  it('says nothing for orders that are being served', () => {
    expect(describeRefund(order({ status: ORDER_STATUS.ACCEPTED }), NOW)).toBeNull();
  });

  it('is in progress right after a reject or cancel while the payment is still PAID', () => {
    const rejected = order({ status: ORDER_STATUS.REJECTED, paymentStatus: PAYMENT_STATUS.PAID });
    expect(describeRefund(rejected, NOW)).toBe(REFUND_STATE.IN_PROGRESS);
  });

  it('needs a check when the refund is still open after ten minutes', () => {
    const stuck = order({
      status: ORDER_STATUS.CANCELLED,
      paymentStatus: PAYMENT_STATUS.PAID,
      placedAt: new Date(NOW - 11 * MS_PER_MINUTE).toISOString(),
    });
    expect(describeRefund(stuck, NOW)).toBe(REFUND_STATE.NEEDS_CHECK);
  });

  it('is done once the payment is REFUNDED', () => {
    const done = order({ status: ORDER_STATUS.REJECTED, paymentStatus: PAYMENT_STATUS.REFUNDED });
    expect(describeRefund(done, NOW)).toBe(REFUND_STATE.DONE);
  });

  it('counts from when the order ended, not from when it was paid', () => {
    const justCancelled = order({
      status: ORDER_STATUS.CANCELLED,
      paymentStatus: PAYMENT_STATUS.PAID,
      placedAt: new Date(NOW - 60 * MS_PER_MINUTE).toISOString(),
      endedAt: new Date(NOW - MS_PER_MINUTE).toISOString(),
    });
    expect(describeRefund(justCancelled, NOW)).toBe(REFUND_STATE.IN_PROGRESS);
  });
});
