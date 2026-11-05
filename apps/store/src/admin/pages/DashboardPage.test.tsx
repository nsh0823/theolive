import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './DashboardPage';

type SummaryState = {
  status: 'success' | 'error' | 'pending';
  data: unknown;
  refetch: () => void;
  isError: boolean;
};
const sales = vi.hoisted(() => {
  const summary: SummaryState = {
    status: 'success',
    data: undefined,
    refetch: () => undefined,
    isError: false,
  };
  const popular: { data: { name: string; quantity: number }[]; isError: boolean } = {
    data: [],
    isError: false,
  };
  return { summary, popular };
});

vi.mock('@theolive/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@theolive/api')>()),
  useSalesSummary: () => sales.summary,
  usePopularItems: () => sales.popular,
  useStoreStatus: () => ({ data: { isOpen: true, isAcceptingOrders: true }, isError: false }),
}));
vi.mock('@/data/orderQueries', () => ({
  useAdminOrdersQuery: () => ({ status: 'success', data: [], refetch: vi.fn() }),
}));

function day(date: string, salesWon: number, orderCount: number) {
  return { date, sales: salesWon, orderCount };
}

describe('DashboardPage (SA-01, SA-02)', () => {
  it('shows today from the last server day (a refund-adjusted total) and the popular ranking', () => {
    sales.summary.status = 'success';
    sales.summary.data = {
      days: [day('2026-11-04', 9000, 2), day('2026-11-05', 8500, 3)],
      total: 17500,
      orderCount: 5,
      averageAmount: 3500,
    };
    sales.popular.data = [
      { name: '카페 라떼', quantity: 4 },
      { name: '아메리카노', quantity: 3 },
    ];
    renderWithProviders(<DashboardPage />);
    expect(screen.getAllByText('8,500원').length).toBeGreaterThan(0);
    expect(screen.getByText('결제 완료 기준 · 환불 제외')).toBeInTheDocument();
    expect(screen.getByText('3건')).toBeInTheDocument();
    // 8,500 / 3 orders, rounded.
    expect(screen.getByText('2,833원')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText('카페 라떼')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /일별 매출/ })).toBeInTheDocument();
  });

  it('shows the empty state when nothing was sold', () => {
    sales.summary.data = {
      days: [day('2026-11-05', 0, 0)],
      total: 0,
      orderCount: 0,
      averageAmount: 0,
    };
    sales.popular.data = [];
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('아직 집계할 주문이 없어요')).toBeInTheDocument();
  });

  it('shows an error with a retry', () => {
    sales.summary.status = 'error';
    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole('button', { name: /다시/ })).toBeInTheDocument();
  });

  it('shows loading', () => {
    sales.summary.status = 'pending';
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('대시보드를 불러오는 중이에요')).toBeInTheDocument();
  });
});
