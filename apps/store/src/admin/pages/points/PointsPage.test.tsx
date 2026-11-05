import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';
import { renderWithProviders, TEST_ADMIN_STATE } from '@/test/render';
import { PointsPage } from './PointsPage';

async function codesTable(): Promise<HTMLElement> {
  return screen.findByRole('table', { name: '쿠폰 포인트 코드 발급 내역' });
}

describe('PointsPage (Store Admin 쿠폰 포인트, SA-08)', () => {
  it('lists the server codes masked, with derived remaining points and totals', async () => {
    renderWithProviders(<PointsPage />, '/admin/points');
    const table = await codesTable();
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByText('OLIVE-••••-9QXD')).toBeInTheDocument();
    expect(within(table).getByText('전액 사용')).toBeInTheDocument();
    expect(await screen.findByText('고객 잔여 포인트')).toBeInTheDocument();
    // The full code is never in the list.
    expect(screen.queryByText('OLIVE-7K2M-9QXD')).not.toBeInTheDocument();
  });

  it('filters by status through the server', async () => {
    const { fake } = renderWithProviders(<PointsPage />, '/admin/points');
    await codesTable();
    await userEvent.selectOptions(screen.getByLabelText('상태 필터'), 'UNUSED');
    await waitFor(() =>
      expect(
        fake.calls.rpc.some(
          (c) => c.name === 'admin_list_point_codes' && JSON.stringify(c.args).includes('"UNUSED"'),
        ),
      ).toBe(true),
    );
    await waitFor(async () =>
      expect(within(await codesTable()).getAllByRole('row')).toHaveLength(2),
    );
  });

  it('looks up a full code on the server and reports an unknown one', async () => {
    renderWithProviders(<PointsPage />, '/admin/points');
    await codesTable();
    const search = screen.getByRole('search', { name: '쿠폰 포인트 코드 조회' });
    await userEvent.type(within(search).getByLabelText('쿠폰 코드'), 'olive-3h8r-tw4n');
    await userEvent.click(within(search).getByRole('button', { name: '조회' }));
    expect(await screen.findByText('미등록', { selector: 'dd span' })).toBeInTheDocument();
    await userEvent.clear(within(search).getByLabelText('쿠폰 코드'));
    await userEvent.type(within(search).getByLabelText('쿠폰 코드'), 'OLIVE-0000-0000');
    await userEvent.click(within(search).getByRole('button', { name: '조회' }));
    expect(await screen.findByText(/일치하는 코드가 없어요/)).toBeInTheDocument();
  });

  it('issues a batch, shows the full codes once, and lists them masked afterwards', async () => {
    const { fake } = renderWithProviders(<PointsPage />, '/admin/points');
    await codesTable();
    await userEvent.clear(screen.getByLabelText('발급 개수'));
    await userEvent.type(screen.getByLabelText('발급 개수'), '2');
    await userEvent.type(screen.getByLabelText('만료일'), '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: '코드 발급' }));
    const dialog = await screen.findByRole('dialog', { name: '발급된 코드' });
    const shown = within(dialog).getAllByRole('listitem');
    expect(shown).toHaveLength(2);
    const firstCode = shown[0]?.textContent ?? '';
    expect(firstCode).toMatch(/^OLIVE-/);
    expect(fake.calls.rpc.find((c) => c.name === 'admin_issue_point_codes')?.args).toEqual({
      p_amount: 5000,
      p_quantity: 2,
      p_expires_on: '2099-01-01',
      p_memo: '',
    });
    // The dialog has a header close button and the footer one; the footer button is the last.
    for (const button of within(dialog).getAllByRole('button', { name: '닫기' }).slice(-1)) {
      await userEvent.click(button);
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(firstCode)).not.toBeInTheDocument();
    await waitFor(async () =>
      expect(within(await codesTable()).getAllByRole('row')).toHaveLength(7),
    );
  });

  it('checks the issue form before calling the server', async () => {
    const { fake } = renderWithProviders(<PointsPage />, '/admin/points');
    await codesTable();
    await userEvent.clear(screen.getByLabelText('포인트 금액 (원)'));
    await userEvent.type(screen.getByLabelText('포인트 금액 (원)'), '500');
    await userEvent.click(screen.getByRole('button', { name: '코드 발급' }));
    expect(await screen.findByText(/1,000원 이상 100,000원 이하/)).toBeInTheDocument();
    expect(screen.getByText('오늘 이후 날짜를 선택해 주세요.')).toBeInTheDocument();
    expect(fake.calls.rpc.some((c) => c.name === 'admin_issue_point_codes')).toBe(false);
  });

  it('voids an unregistered code after a confirmation, and offers no void for registered ones', async () => {
    const { fake } = renderWithProviders(<PointsPage />, '/admin/points');
    const table = await codesTable();
    expect(within(table).getAllByRole('button', { name: /무효로 바꾸기/ })).toHaveLength(1);
    await userEvent.click(
      within(table).getByRole('button', { name: 'OLIVE-••••-TW4N 무효로 바꾸기' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '무효로 바꾸기' }));
    await waitFor(() =>
      expect(fake.calls.rpc.find((c) => c.name === 'admin_void_point_code')?.args).toEqual({
        p_code_id: 'pc-2',
      }),
    );
    expect(await within(await codesTable()).findByText('무효')).toBeInTheDocument();
  });

  it('saves the use rules, with no cap when blank', async () => {
    const { fake } = renderWithProviders(<PointsPage />, '/admin/points');
    const minimum = await screen.findByLabelText('최소 사용 금액 (원)');
    await userEvent.clear(minimum);
    await userEvent.type(minimum, '1000');
    await userEvent.clear(screen.getByLabelText('사용 단위 (원)'));
    await userEvent.type(screen.getByLabelText('사용 단위 (원)'), '100');
    await userEvent.click(screen.getByRole('button', { name: '규칙 저장' }));
    await waitFor(() =>
      expect(fake.tables.coupon_point_policy?.[0]).toMatchObject({
        min_use_amount: 1000,
        use_unit: 100,
        max_use_per_order: null,
      }),
    );
  });

  it('refuses a zero unit and shows the field error', async () => {
    renderWithProviders(<PointsPage />, '/admin/points');
    const unit = await screen.findByLabelText('사용 단위 (원)');
    await userEvent.clear(unit);
    await userEvent.type(unit, '0');
    await userEvent.click(screen.getByRole('button', { name: '규칙 저장' }));
    expect(await screen.findByText('1 이상의 숫자로 입력해 주세요.')).toBeInTheDocument();
  });

  it('shows a retryable error when the list cannot be loaded', async () => {
    const fake = createFakeSupabase();
    fake.failWith('admin_list_point_codes', 'INTERNAL');
    renderWithProviders(<PointsPage />, '/admin/points', TEST_ADMIN_STATE, fake);
    expect(await screen.findAllByRole('button', { name: /다시/ })).not.toHaveLength(0);
    fake.clearFailure('admin_list_point_codes');
    for (const retry of (await screen.findAllByRole('button', { name: /다시/ })).slice(0, 1)) {
      await userEvent.click(retry);
    }
    expect(await codesTable()).toBeInTheDocument();
  });
});
