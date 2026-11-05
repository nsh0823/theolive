import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { pointCodesStore, stampOverviewStore } from '@/data/stores';
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
    expect(screen.getByText('10개')).toBeInTheDocument();
    expect(screen.getByText('15개')).toBeInTheDocument();
    expect(screen.queryByText(/OLIVE-[0-9A-Z]{4}-/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /쿠폰 포인트 코드/ })).not.toBeInTheDocument();
    expect(screen.queryByText('고객 잔여 포인트')).not.toBeInTheDocument();
  });

  it('point page shows codes and won balances, and no stamp data', async () => {
    renderWithProviders(<PointsPage />);
    const table = await screen.findByRole('table', { name: /쿠폰 포인트 코드/ });
    expect(within(table).getByText('OLIVE-7K2M-9QXD')).toBeInTheDocument();
    expect(screen.getByText('고객 잔여 포인트')).toBeInTheDocument();
    expect(screen.queryByText('쿠폰 교환 규칙')).not.toBeInTheDocument();
    expect(screen.queryByText('스탬프 적립 정책')).not.toBeInTheDocument();
    expect(screen.queryByText('적립된 스탬프')).not.toBeInTheDocument();
  });

  it('uses separate data stores: issuing point codes never changes the stamp overview', async () => {
    const stampsBefore = stampOverviewStore.get();
    const codesBefore = pointCodesStore.get().length;
    renderWithProviders(<PointsPage />);
    await screen.findByRole('table', { name: /쿠폰 포인트 코드/ });
    await userEvent.type(screen.getByLabelText('만료일'), '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: '코드 발급' }));
    expect(pointCodesStore.get().length).toBe(codesBefore + 1);
    expect(stampOverviewStore.get()).toEqual(stampsBefore);
  });

  it('looks up a point code and reports an unknown one', async () => {
    renderWithProviders(<PointsPage />);
    await screen.findByRole('table', { name: /쿠폰 포인트 코드/ });
    const search = screen.getByRole('search', { name: '쿠폰 포인트 코드 조회' });
    await userEvent.type(within(search).getByLabelText('쿠폰 코드'), 'olive-3h8r-tw4n');
    await userEvent.click(within(search).getByRole('button', { name: '조회' }));
    expect(await screen.findByText('미등록', { selector: 'dd span' })).toBeInTheDocument();
    await userEvent.clear(within(search).getByLabelText('쿠폰 코드'));
    await userEvent.type(within(search).getByLabelText('쿠폰 코드'), 'OLIVE-0000-0000');
    await userEvent.click(within(search).getByRole('button', { name: '조회' }));
    expect(await screen.findByText(/일치하는 코드가 없어요/)).toBeInTheDocument();
  });
});
