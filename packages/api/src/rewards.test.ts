import { describe, expect, it, vi } from 'vitest';
import type { CouponRow, StampTransactionRow, UserCouponViewRow } from '@theolive/types';

import {
  fetchCheckoutQuote,
  type CheckoutQuoteLine,
  nextStampGoal,
  redeemStamps,
  toCouponView,
  toExchangeOption,
  toStampLedgerEntry,
} from './rewards';
import { setStampPolicy, toCouponRuleView } from './rewardsAdmin';

const UUID_A = '00000000-0000-4000-8000-0000000000a1';
const UUID_B = '00000000-0000-4000-8000-0000000000b1';

const couponRow: CouponRow = {
  id: UUID_A,
  title: '아메리카노 또는 라떼 쿠폰',
  required_stamps: 10,
  valid_days: 90,
  benefit_type: 'FREE_ITEM',
  discount_amount: null,
  eligible_category_ids: [],
  eligible_menu_item_ids: [UUID_B],
  is_active: true,
  sort_order: 1,
  created_at: '2026-11-05T00:00:00Z',
  updated_at: '2026-11-05T00:00:00Z',
};

const walletRow: UserCouponViewRow = {
  id: UUID_A,
  user_id: UUID_B,
  coupon_id: UUID_B,
  title_snapshot: '전체 음료 쿠폰',
  benefit_type_snapshot: 'FREE_ITEM',
  discount_amount_snapshot: 3000,
  eligible_category_ids_snapshot: [],
  eligible_menu_item_ids_snapshot: [],
  display_status: 'AVAILABLE',
  issued_at: '2026-11-05T00:00:00Z',
  expires_at: '2027-02-04T15:00:00Z',
  used_at: null,
};

describe('nextStampGoal (HOME-04)', () => {
  it('is the smallest cost above the balance', () => {
    expect(nextStampGoal(7, [15, 10])).toBe(10);
    expect(nextStampGoal(10, [15, 10])).toBe(15);
  });
  it('is the largest cost once every cost is reached', () => {
    expect(nextStampGoal(20, [10, 15])).toBe(15);
  });
  it('is 0 when no exchange rule is active', () => {
    expect(nextStampGoal(3, [])).toBe(0);
  });
});

describe('row mappers', () => {
  it('maps an exchange rule', () => {
    expect(toExchangeOption(couponRow)).toMatchObject({
      id: UUID_A,
      requiredStamps: 10,
      validDays: 90,
      benefitType: 'FREE_ITEM',
      discountAmount: null,
    });
  });
  it('maps a ledger row', () => {
    const row: StampTransactionRow = {
      id: 5,
      user_id: UUID_B,
      kind: 'EARN',
      delta: 1,
      balance_after: 3,
      order_id: UUID_A,
      user_coupon_id: null,
      idempotency_key: 'earn:x',
      label: '주문 적립',
      actor_id: null,
      created_at: '2026-11-05T00:00:00Z',
    };
    expect(toStampLedgerEntry(row)).toEqual({
      id: 5,
      kind: 'EARN',
      delta: 1,
      balanceAfter: 3,
      label: '주문 적립',
      createdAt: '2026-11-05T00:00:00Z',
      orderId: UUID_A,
    });
  });
  it('maps a wallet coupon and keeps the server display status', () => {
    expect(toCouponView(walletRow)).toMatchObject({ title: '전체 음료 쿠폰', status: 'AVAILABLE' });
    expect(toCouponView({ ...walletRow, display_status: 'EXPIRED' })?.status).toBe('EXPIRED');
  });
  it('shows a coupon held by an open checkout as available and a void one as expired', () => {
    expect(toCouponView({ ...walletRow, display_status: 'RESERVED' })?.status).toBe('AVAILABLE');
    expect(toCouponView({ ...walletRow, display_status: 'VOID' })?.status).toBe('EXPIRED');
  });
  it('drops a view row without a computed status', () => {
    expect(toCouponView({ ...walletRow, display_status: null })).toBeNull();
  });
  it('maps a rule for the admin', () => {
    expect(toCouponRuleView(couponRow)).toMatchObject({
      requiredStamps: 10,
      eligibleMenuItemIds: [UUID_B],
      isActive: true,
    });
  });
});

describe('redeemStamps', () => {
  it('sends the ids only and maps the answer', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { userCouponId: UUID_A, stampBalance: 2, isReplay: false },
      error: null,
    });
    const result = await redeemStamps({ rpc } as never, {
      couponId: UUID_A,
      clientRequestId: UUID_B,
    });
    expect(rpc).toHaveBeenCalledWith('redeem_stamps_for_coupon', {
      p_coupon_id: UUID_A,
      p_client_request_id: UUID_B,
    });
    expect(result).toEqual({ userCouponId: UUID_A, stampBalance: 2, isReplay: false });
  });
  it('turns a server error into its app error code', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'INSUFFICIENT_STAMPS' },
    });
    await expect(
      redeemStamps({ rpc } as never, { couponId: UUID_A, clientRequestId: UUID_B }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STAMPS' });
  });
  it('refuses a malformed request before calling the server', async () => {
    const rpc = vi.fn();
    await expect(
      redeemStamps({ rpc } as never, { couponId: 'nope', clientRequestId: UUID_B }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('fetchCheckoutQuote', () => {
  it('passes the lines and coupon and reads the server amounts', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        menuAmount: 9000,
        couponDiscount: 4500,
        pointsUsed: 0,
        paidAmount: 4500,
        usableCouponIds: [UUID_A],
        pointsAvailable: 0,
        maxPointsUsable: 0,
      },
      error: null,
    });
    const lines: CheckoutQuoteLine[] = [{ menuItemId: UUID_B, temperature: 'HOT', quantity: 2 }];
    const quote = await fetchCheckoutQuote({ rpc } as never, lines, UUID_A);
    expect(rpc).toHaveBeenCalledWith('quote_checkout', {
      p_lines: lines,
      p_user_coupon_id: UUID_A,
      p_points_to_use: 0,
    });
    expect(quote).toEqual({
      menuAmount: 9000,
      couponDiscount: 4500,
      pointsUsed: 0,
      paidAmount: 4500,
      usableCouponIds: [UUID_A],
      pointsAvailable: 0,
      maxPointsUsable: 0,
    });
  });
  it('maps COUPON_EXPIRED', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'COUPON_EXPIRED' },
    });
    await expect(fetchCheckoutQuote({ rpc } as never, [], UUID_A)).rejects.toMatchObject({
      code: 'COUPON_EXPIRED',
    });
  });
});

describe('setStampPolicy', () => {
  it('has no timing argument (OQ-24)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    await setStampPolicy({ rpc } as never, { earnMode: 'PER_ORDER', stampsPerOrder: 1 });
    expect(rpc).toHaveBeenCalledWith('admin_set_stamp_policy', {
      p_earn_mode: 'PER_ORDER',
      p_stamps_per_order: 1,
      p_amount_per_stamp: undefined,
      p_earn_basis: 'MENU_AMOUNT',
    });
  });
  it('refuses a per-amount policy below the minimum before calling the server', async () => {
    const rpc = vi.fn();
    await expect(
      setStampPolicy({ rpc } as never, { earnMode: 'PER_AMOUNT', amountPerStamp: 10 }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
