import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RewardsPage } from './RewardsPage';

function card(heading: string): HTMLElement {
  const section = screen.getByRole('heading', { name: heading }).closest('section');
  if (!section) throw new Error(`no card for ${heading}`);
  return section;
}

describe('RewardsPage (Store Admin 리워드 관리, SA-07)', () => {
  it('shows the server overview, issued coupons, and active and inactive rules', async () => {
    renderWithProviders(<RewardsPage />, '/admin/rewards');
    expect(await screen.findByText('42개')).toBeInTheDocument();
    expect(screen.getByText('120개')).toBeInTheDocument();
    const rules = await screen.findByRole('table', { name: '스탬프 쿠폰 교환 규칙' });
    expect(within(rules).getAllByText('교환 가능')).toHaveLength(2);
    expect(within(rules).getByText('시즌 정액 쿠폰')).toBeInTheDocument();
    expect(within(rules).getByText('중지')).toBeInTheDocument();
    expect(within(rules).getByText('1개 무료 (최대 5,500원)')).toBeInTheDocument();
    const issued = await screen.findByRole('table', { name: '발급된 스탬프 교환 쿠폰' });
    expect(within(issued).getAllByRole('row')).toHaveLength(4);
  });

  it('shows the earn timing as fixed text, not as a selector', async () => {
    renderWithProviders(<RewardsPage />, '/admin/rewards');
    await screen.findByLabelText('주문 1건당 스탬프 (개)');
    expect(screen.getByText('수령 완료 시 (고정)')).toBeInTheDocument();
    expect(screen.queryByLabelText('적립 시점')).not.toBeInTheDocument();
    expect(screen.queryByText('점주 확정 필요')).not.toBeInTheDocument();
  });

  it('saves a per-order policy through the RPC with no timing argument', async () => {
    const { fake } = renderWithProviders(<RewardsPage />, '/admin/rewards');
    const input = await screen.findByLabelText('주문 1건당 스탬프 (개)');
    await userEvent.clear(input);
    await userEvent.type(input, '2');
    await userEvent.click(
      within(card('스탬프 적립 정책')).getByRole('button', { name: '정책 저장' }),
    );
    await waitFor(() =>
      expect(fake.calls.rpc.some((c) => c.name === 'admin_set_stamp_policy')).toBe(true),
    );
    const call = fake.calls.rpc.find((c) => c.name === 'admin_set_stamp_policy');
    expect(call?.args).toEqual({
      p_earn_mode: 'PER_ORDER',
      p_stamps_per_order: 2,
      p_amount_per_stamp: undefined,
      p_earn_basis: 'MENU_AMOUNT',
    });
    expect(await screen.findByDisplayValue('2')).toBeInTheDocument();
  });

  it('saves a per-amount policy and refuses less than 1,000 won', async () => {
    const { fake } = renderWithProviders(<RewardsPage />, '/admin/rewards');
    await userEvent.selectOptions(await screen.findByLabelText('적립 기준'), 'PER_AMOUNT');
    const amount = screen.getByLabelText('스탬프 1개당 금액 (원)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '500');
    const save = within(card('스탬프 적립 정책')).getByRole('button', { name: '정책 저장' });
    await userEvent.click(save);
    expect(await screen.findByText('1,000원 이상의 숫자로 입력해 주세요.')).toBeInTheDocument();
    expect(fake.calls.rpc.filter((c) => c.name === 'admin_set_stamp_policy')).toHaveLength(0);
    await userEvent.clear(amount);
    await userEvent.type(amount, '4000');
    await userEvent.click(save);
    await waitFor(() =>
      expect(fake.calls.rpc.find((c) => c.name === 'admin_set_stamp_policy')?.args).toMatchObject({
        p_earn_mode: 'PER_AMOUNT',
        p_amount_per_stamp: 4000,
        p_stamps_per_order: undefined,
      }),
    );
  });

  it('shows the server refusal when saving the policy is denied', async () => {
    const { fake } = renderWithProviders(<RewardsPage />, '/admin/rewards');
    fake.failWith('admin_set_stamp_policy', 'FORBIDDEN');
    await screen.findByLabelText('주문 1건당 스탬프 (개)');
    await userEvent.click(
      within(card('스탬프 적립 정책')).getByRole('button', { name: '정책 저장' }),
    );
    expect(await screen.findByText('이 작업을 할 권한이 없어요.')).toBeInTheDocument();
  });

  it('creates a rule with an optional cap, refuses bad input, and keeps a rule on edit', async () => {
    const { fake } = renderWithProviders(<RewardsPage />, '/admin/rewards');
    await userEvent.click(await screen.findByRole('button', { name: '규칙 추가' }));
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('1~99 사이의 숫자로 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('쿠폰 이름을 30자 이내로 입력해 주세요.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('필요한 스탬프 (개)'), '5');
    await userEvent.type(screen.getByLabelText('교환 쿠폰 이름'), '새 쿠폰');
    await userEvent.type(screen.getByLabelText('최대 할인 금액 (원, 선택)'), '4000');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(fake.tables.coupons?.find((c) => c.title === '새 쿠폰')).toMatchObject({
        required_stamps: 5,
        valid_days: 90,
        benefit_type: 'FREE_ITEM',
        discount_amount: 4000,
      }),
    );
    expect(await screen.findByText('1개 무료 (최대 4,000원)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '시즌 정액 쿠폰 수정' }));
    const days = screen.getByLabelText('유효기간 (일)');
    await userEvent.clear(days);
    await userEvent.type(days, '30');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() =>
      expect(fake.tables.coupons?.find((c) => c.id === 'rule-20')).toMatchObject({
        valid_days: 30,
        benefit_type: 'FIXED_AMOUNT',
        discount_amount: 3000,
      }),
    );
  });

  it('deactivates and reactivates a rule instead of deleting it', async () => {
    const { fake } = renderWithProviders(<RewardsPage />, '/admin/rewards');
    expect(screen.queryByRole('button', { name: /삭제/ })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: '전체 음료 쿠폰 중지' }));
    await waitFor(() =>
      expect(fake.tables.coupons?.find((c) => c.id === 'rule-15')?.is_active).toBe(false),
    );
    await userEvent.click(await screen.findByRole('button', { name: '전체 음료 쿠폰 다시 켜기' }));
    await waitFor(() =>
      expect(fake.tables.coupons?.find((c) => c.id === 'rule-15')?.is_active).toBe(true),
    );
    expect(fake.tables.coupons).toHaveLength(3);
  });

  it('shows an error state with retry', async () => {
    const { fake } = renderWithProviders(<RewardsPage />, '/admin/rewards');
    fake.failWith('read:coupons', 'boom');
    expect(await screen.findAllByText('데이터를 불러오지 못했어요')).not.toHaveLength(0);
  });
});
