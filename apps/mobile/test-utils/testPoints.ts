import type { LedgerEntry, PointSummary } from '@/models';
import type { QueryState } from '@/lib/queryState';

/** Stand-ins for the server's Coupon Point answers in screen tests. */
export const TEST_POINTS: PointSummary = {
  balance: 12000,
  held: 0,
  available: 12000,
  nextExpiresAt: null,
};

export const TEST_POINT_LEDGER: LedgerEntry[] = [
  {
    id: '3',
    kind: 'CANCEL',
    label: '환불로 포인트 복구',
    amount: 1000,
    at: '2026.11.04',
    note: '유효기간 2027.02.04까지',
  },
  { id: '2', kind: 'USE', label: '주문 결제', amount: -3000, at: '2026.11.03' },
  {
    id: '1',
    kind: 'EARN',
    label: '코드 등록',
    amount: 15000,
    at: '2026.11.01',
    note: '유효기간 2027.02.04까지',
  },
];

export const pointsDefault = (): QueryState<PointSummary> => ({
  status: 'success',
  data: TEST_POINTS,
});
export const pointLedgerDefault = (): QueryState<LedgerEntry[]> => ({
  status: 'success',
  data: TEST_POINT_LEDGER,
});
