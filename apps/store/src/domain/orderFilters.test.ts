import { describe, expect, it } from 'vitest';
import { EMPTY_ORDER_FILTERS, filterOrders, hasActiveFilters } from './orderFilters';
import {
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  TEMPERATURE,
  type Order,
} from './models';

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 'o',
    orderNumber: 'A-01',
    placedAt: '2026-11-05T09:00:00',
    status: ORDER_STATUS.COMPLETED,
    paymentStatus: PAYMENT_STATUS.PAID,
    paymentMethod: PAYMENT_METHOD.CARD,
    orderType: ORDER_TYPE.DINE_IN,
    lines: [
      {
        menuItemId: 'americano',
        name: '아메리카노',
        temperature: TEMPERATURE.ICE,
        quantity: 1,
        unitPrice: 4500,
      },
    ],
    note: null,
    menuAmount: 4500,
    couponDiscount: 0,
    pointsUsed: 0,
    paidAmount: 4500,
    rejectReason: null,
    memberId: null,
    ...overrides,
  };
}

const orders: Order[] = [
  makeOrder({ id: '1', orderNumber: 'A-01', placedAt: '2026-11-03T10:00:00' }),
  makeOrder({
    id: '2',
    orderNumber: 'A-02',
    placedAt: '2026-11-04T11:00:00',
    orderType: ORDER_TYPE.TAKEOUT,
    status: ORDER_STATUS.REJECTED,
    paymentStatus: PAYMENT_STATUS.REFUNDED,
    lines: [
      {
        menuItemId: 'latte',
        name: '카페 라떼',
        temperature: TEMPERATURE.HOT,
        quantity: 2,
        unitPrice: 5000,
      },
    ],
  }),
  makeOrder({ id: '3', orderNumber: 'A-03', placedAt: '2026-11-05T12:00:00' }),
];

describe('filterOrders', () => {
  it('returns everything, newest first, with no filters', () => {
    expect(filterOrders(orders, EMPTY_ORDER_FILTERS).map((o) => o.id)).toEqual(['3', '2', '1']);
    expect(hasActiveFilters(EMPTY_ORDER_FILTERS)).toBe(false);
  });

  it('searches order number and menu name, ignoring case and spaces at the ends', () => {
    expect(filterOrders(orders, { ...EMPTY_ORDER_FILTERS, query: ' a-02 ' })).toHaveLength(1);
    expect(
      filterOrders(orders, { ...EMPTY_ORDER_FILTERS, query: '라떼' }).map((o) => o.id),
    ).toEqual(['2']);
  });

  it('applies an inclusive date range, with open ends', () => {
    const range = { ...EMPTY_ORDER_FILTERS, dateFrom: '2026-11-04', dateTo: '2026-11-05' };
    expect(filterOrders(orders, range).map((o) => o.id)).toEqual(['3', '2']);
    expect(filterOrders(orders, { ...EMPTY_ORDER_FILTERS, dateTo: '2026-11-03' })).toHaveLength(1);
  });

  it('filters by status, payment status and order type together', () => {
    const filters = {
      ...EMPTY_ORDER_FILTERS,
      status: ORDER_STATUS.REJECTED,
      paymentStatus: PAYMENT_STATUS.REFUNDED,
      orderType: ORDER_TYPE.TAKEOUT,
    };
    expect(filterOrders(orders, filters).map((o) => o.id)).toEqual(['2']);
    expect(hasActiveFilters(filters)).toBe(true);
    expect(filterOrders(orders, { ...filters, orderType: ORDER_TYPE.DINE_IN })).toEqual([]);
  });
});
