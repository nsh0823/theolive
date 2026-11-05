import type { Order } from '@/models';

const AMERICANO = 'americano';

/** A paid order as the server returns it; override what a test cares about. */
export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'A-34',
    placedAt: '2026-11-04T04:50:00.000Z',
    paidAt: '2026-11-04T04:50:00.000Z',
    expiresAt: '2026-11-04T05:05:00.000Z',
    status: 'PAID',
    paymentStatus: 'PAID',
    paymentMethod: 'CARD',
    orderType: 'TAKEOUT',
    lines: [
      {
        menuItemId: AMERICANO,
        name: '아메리카노',
        temperature: 'ICE',
        quantity: 2,
        unitPrice: 4500,
      },
    ],
    note: null,
    menuAmount: 9000,
    couponDiscount: 0,
    couponTitle: null,
    pointsUsed: 0,
    paidAmount: 9000,
    memberId: 'customer-1',
    rejectReasonCode: null,
    rejectReason: null,
    cancelReason: null,
    endedAt: null,
    ...overrides,
  };
}
