import type { Coupon, LedgerEntry, StampExchangeOption, StampSummary } from '@/models';
import type { QueryState } from '@/lib/queryState';

/** Stand-ins for the server's stamp and coupon answers in screen tests. */
export const TEST_STAMPS: StampSummary = { count: 7, goal: 10 };

export const TEST_EXCHANGE_OPTIONS: StampExchangeOption[] = [
  {
    id: 'rule-10',
    requiredStamps: 10,
    validDays: 90,
    title: '아메리카노 또는 라떼 쿠폰',
    benefitType: 'FREE_ITEM',
    discountAmount: null,
  },
  {
    id: 'rule-5',
    requiredStamps: 5,
    validDays: 30,
    title: '정액 쿠폰',
    benefitType: 'FIXED_AMOUNT',
    discountAmount: 3000,
  },
];

export const TEST_COUPONS: Coupon[] = [
  {
    id: 'coupon-1',
    title: '아메리카노 또는 라떼 쿠폰',
    benefitType: 'FREE_ITEM',
    discountAmount: null,
    issuedAt: '2026-11-01T00:00:00.000Z',
    // Midnight KST after the last valid day (2026.12.31).
    expiresAt: '2026-12-31T15:00:00.000Z',
    usedAt: null,
    status: 'AVAILABLE',
  },
  {
    id: 'coupon-2',
    title: '전체 음료 쿠폰',
    benefitType: 'FREE_ITEM',
    discountAmount: 5500,
    issuedAt: '2026-10-01T00:00:00.000Z',
    expiresAt: '2026-11-30T15:00:00.000Z',
    usedAt: '2026-11-02T00:00:00.000Z',
    status: 'USED',
  },
  {
    id: 'coupon-3',
    title: '정액 쿠폰',
    benefitType: 'FIXED_AMOUNT',
    discountAmount: 3000,
    issuedAt: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-09-30T15:00:00.000Z',
    usedAt: null,
    status: 'EXPIRED',
  },
];

export const TEST_STAMP_LEDGER: LedgerEntry[] = [
  { id: '3', kind: 'EARN', label: '주문 적립', amount: 1, at: '2026.11.03' },
  { id: '2', kind: 'USE', label: '쿠폰 교환', amount: -10, at: '2026.10.15' },
];

export const stampsDefault = (): QueryState<StampSummary> => ({
  status: 'success',
  data: TEST_STAMPS,
});
export const exchangeDefault = (): QueryState<StampExchangeOption[]> => ({
  status: 'success',
  data: TEST_EXCHANGE_OPTIONS,
});
export const couponsDefault = (): QueryState<Coupon[]> => ({
  status: 'success',
  data: TEST_COUPONS,
});
export const ledgerDefault = (): QueryState<LedgerEntry[]> => ({
  status: 'success',
  data: TEST_STAMP_LEDGER,
});
