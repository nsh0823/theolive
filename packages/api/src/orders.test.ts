import { describe, expect, it, vi } from 'vitest';
import type { OrderItemRow, OrderRow } from '@theolive/types';

import { cancelMyOrder, isTerminalOrder, toOrderView } from './orders';
import { toOrderStatus, toPaymentStatus } from './statusGuards';
import { adminCancelOrder, transitionOrder } from './staffOrders';

const ORDER_ID = '00000000-0000-4000-8000-0000000000aa';

const orderRow: OrderRow = {
  id: ORDER_ID,
  order_number: 'A-7',
  business_date: '2026-11-05',
  customer_id: '00000000-0000-4000-8000-0000000000c1',
  client_request_id: '00000000-0000-4000-8000-0000000000bb',
  request_hash: 'x',
  order_type: 'TAKEOUT',
  status: 'PAID',
  payment_status: 'PAID',
  payment_method: 'CARD',
  note: null,
  menu_amount: 9000,
  coupon_discount: 0,
  coupon_title_snapshot: null,
  user_coupon_id: null,
  stamp_policy_id: null,
  points_used: 0,
  paid_amount: 9000,
  reject_reason_code: null,
  reject_reason: null,
  cancel_reason: null,
  expires_at: '2026-11-05T00:15:00Z',
  created_at: '2026-11-05T00:00:00Z',
  paid_at: '2026-11-05T00:01:00Z',
  accepted_at: null,
  preparing_at: null,
  ready_at: null,
  completed_at: null,
  rejected_at: null,
  cancelled_at: null,
  updated_at: '2026-11-05T00:01:00Z',
};

function item(name: string, sortOrder: number, temperature: 'HOT' | null): OrderItemRow {
  return {
    id: `item-${sortOrder}`,
    order_id: ORDER_ID,
    menu_item_id: null,
    name_snapshot: name,
    temperature,
    quantity: 2,
    unit_price: 4500,
    line_total: 9000,
    sort_order: sortOrder,
  };
}

describe('toOrderView', () => {
  it('maps the snapshot, keeps line order and uses the paid time as placedAt', () => {
    const view = toOrderView({
      ...orderRow,
      order_items: [item('두번째', 2, null), item('첫번째', 1, 'HOT')],
    });
    expect(view.lines.map((line) => line.name)).toEqual(['첫번째', '두번째']);
    expect(view.lines[1]?.temperature).toBeNull();
    expect(view).toMatchObject({
      orderNumber: 'A-7',
      placedAt: '2026-11-05T00:01:00Z',
      paidAmount: 9000,
      endedAt: null,
    });
  });

  it('falls back to the creation time for an unpaid order and reports when it ended', () => {
    const unpaid = toOrderView({
      ...orderRow,
      status: 'CANCELLED',
      paid_at: null,
      order_number: null,
      cancelled_at: '2026-11-05T00:20:00Z',
      order_items: [],
    });
    expect(unpaid).toMatchObject({
      orderNumber: null,
      placedAt: '2026-11-05T00:00:00Z',
      endedAt: '2026-11-05T00:20:00Z',
    });
  });
});

describe('isTerminalOrder', () => {
  it('is final once completed, or cancelled / rejected with the refund settled', () => {
    expect(isTerminalOrder({ status: 'COMPLETED', paymentStatus: 'PAID' })).toBe(true);
    expect(isTerminalOrder({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })).toBe(true);
    expect(isTerminalOrder({ status: 'CANCELLED', paymentStatus: 'FAILED' })).toBe(true);
  });

  it('keeps polling while a refund is in flight or the order is live', () => {
    expect(isTerminalOrder({ status: 'REJECTED', paymentStatus: 'PAID' })).toBe(false);
    expect(isTerminalOrder({ status: 'PREPARING', paymentStatus: 'PAID' })).toBe(false);
    expect(isTerminalOrder({ status: 'PENDING_PAYMENT', paymentStatus: 'READY' })).toBe(false);
  });
});

describe('status guards', () => {
  it('accept known statuses and fail on anything else', () => {
    expect(toOrderStatus('READY')).toBe('READY');
    expect(toPaymentStatus('REFUNDED')).toBe('REFUNDED');
    expect(() => toOrderStatus('DONE')).toThrow();
    expect(() => toPaymentStatus(undefined)).toThrow();
  });
});

describe('order mutations', () => {
  it('transitionOrder sends the status the tablet shows and surfaces STALE_STATUS', async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({ data: null, error: { code: 'P0001', message: 'STALE_STATUS' } }),
    );
    const client = { rpc, functions: { invoke: vi.fn() } } as never;
    await expect(
      transitionOrder(client, { orderId: ORDER_ID, action: 'ACCEPT', expectedStatus: 'PAID' }),
    ).rejects.toMatchObject({ code: 'STALE_STATUS' });
    expect(rpc).toHaveBeenCalledWith(
      'staff_transition_order',
      expect.objectContaining({
        p_order_id: ORDER_ID,
        p_action: 'ACCEPT',
        p_expected_status: 'PAID',
      }),
    );
  });

  it('a reject asks the provider to execute the refund; a replay does not', async () => {
    const invoke = vi.fn(() =>
      Promise.resolve({ data: { refundStatus: 'SUCCEEDED' }, error: null }),
    );
    const rpc = vi.fn(() =>
      Promise.resolve({ data: { status: 'REJECTED', isReplay: false }, error: null }),
    );
    const client = { rpc, functions: { invoke } } as never;
    await transitionOrder(client, {
      orderId: ORDER_ID,
      action: 'REJECT',
      expectedStatus: 'PAID',
      reasonCode: 'SOLD_OUT',
    });
    expect(invoke).toHaveBeenCalledWith('payments-refund', { body: { orderId: ORDER_ID } });
    invoke.mockClear();
    rpc.mockResolvedValueOnce({ data: { status: 'REJECTED', isReplay: true }, error: null });
    await transitionOrder(client, {
      orderId: ORDER_ID,
      action: 'REJECT',
      expectedStatus: 'PAID',
      reasonCode: 'SOLD_OUT',
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('the cancel still counts when the immediate refund call fails (reconcile retries)', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: { status: 'CANCELLED' }, error: null }));
    const invoke = vi.fn(() => Promise.resolve({ data: null, error: new Error('down') }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = { rpc, functions: { invoke } } as never;
    await expect(
      cancelMyOrder(client, { orderId: ORDER_ID, expectedStatus: 'PAID' }),
    ).resolves.toBeUndefined();
    await expect(
      adminCancelOrder(client, { orderId: ORDER_ID, expectedStatus: 'ACCEPTED', reason: '사유' }),
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('a rejected cancel is surfaced with its app error code', async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({ data: null, error: { code: 'P0001', message: 'INVALID_TRANSITION' } }),
    );
    const client = { rpc, functions: { invoke: vi.fn() } } as never;
    await expect(
      cancelMyOrder(client, { orderId: ORDER_ID, expectedStatus: 'ACCEPTED' }),
    ).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });
});
