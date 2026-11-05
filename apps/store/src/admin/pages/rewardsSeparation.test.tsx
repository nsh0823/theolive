import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PointsPage } from './points/PointsPage';
import { RewardsPage } from './rewards/RewardsPage';

describe('Olive Stamps and Coupon Points stay separate', () => {
  it('stamp page shows stamps in 개 with exchange rules, and no point codes or won balances', async () => {
    renderWithProviders(<RewardsPage />);
    expect(await screen.findByText('올리브 스탬프')).toBeInTheDocument();
    const rules = await screen.findByRole('table', { name: '스탬프 쿠폰 교환 규칙' });
    expect(within(rules).getByText('아메리카노 또는 라떼 쿠폰')).toBeInTheDocument();
    expect(within(rules).getByText('전체 음료 쿠폰')).toBeInTheDocument();
    expect(within(rules).getByText('10개')).toBeInTheDocument();
    expect(within(rules).getByText('15개')).toBeInTheDocument();
    expect(screen.queryByText(/OLIVE-/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /쿠폰 포인트 코드/ })).not.toBeInTheDocument();
    expect(screen.queryByText('고객 잔여 포인트')).not.toBeInTheDocument();
  });

  it('point page shows masked codes and won balances, and no stamp data', async () => {
    renderWithProviders(<PointsPage />);
    const table = await screen.findByRole('table', { name: /쿠폰 포인트 코드/ });
    expect(within(table).getByText('OLIVE-••••-9QXD')).toBeInTheDocument();
    expect(screen.getByText('고객 잔여 포인트')).toBeInTheDocument();
    expect(screen.queryByText('쿠폰 교환 규칙')).not.toBeInTheDocument();
    expect(screen.queryByText('스탬프 적립 정책')).not.toBeInTheDocument();
    expect(screen.queryByText('적립된 스탬프')).not.toBeInTheDocument();
  });
});
