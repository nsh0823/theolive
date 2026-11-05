import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FAKE_ORDER_IDS } from '@/test/fakeSupabase';
import { renderWithProviders } from '@/test/render';
import { OrderHistoryPage } from './OrderHistoryPage';

async function openDetail(orderNumber: string): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole('button', { name: `주문 ${orderNumber} 상세 보기` }),
  );
  return screen.findByRole('dialog', { name: `주문 ${orderNumber}` });
}

describe('OrderHistoryPage (Store Admin 주문 내역, server data)', () => {
  it('lists the paid orders the server returns', async () => {
    renderWithProviders(<OrderHistoryPage />, '/admin/orders');
    expect(await screen.findByText('총 5건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '주문 A-41 상세 보기' })).toBeInTheDocument();
  });

  it('narrows by status on the server', async () => {
    renderWithProviders(<OrderHistoryPage />, '/admin/orders');
    await screen.findByText('총 5건');
    await userEvent.selectOptions(screen.getByLabelText('주문 상태'), '주문 거절');
    expect(await screen.findByText('총 1건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '주문 A-20 상세 보기' })).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    const { fake } = renderWithProviders(<OrderHistoryPage />, '/admin/orders');
    fake.failWith('read:orders', 'boom');
    expect(await screen.findByText('데이터를 불러오지 못했어요')).toBeInTheDocument();
    fake.clearFailure('read:orders');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('총 5건')).toBeInTheDocument();
  });

  it('opens the order from a deep link and shows reject reason and refund state', async () => {
    renderWithProviders(<OrderHistoryPage />, `/admin/orders?order=${FAKE_ORDER_IDS.rejected}`);
    const dialog = await screen.findByRole('dialog', { name: '주문 A-20' });
    expect(dialog).toHaveTextContent('재고 부족 (품절)');
    expect(dialog).toHaveTextContent('환불 완료');
    expect(
      within(dialog).queryByRole('button', { name: '주문 취소 / 환불' }),
    ).not.toBeInTheDocument();
  });

  it('offers cancel / refund only for PAID or ACCEPTED orders', async () => {
    renderWithProviders(<OrderHistoryPage />, '/admin/orders');
    const completed = await openDetail('A-30');
    expect(
      within(completed).queryByRole('button', { name: '주문 취소 / 환불' }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    const accepted = await openDetail('A-39');
    expect(within(accepted).getByRole('button', { name: '주문 취소 / 환불' })).toBeInTheDocument();
  });

  it('requires a reason, then cancels through the server and starts the refund', async () => {
    const { fake } = renderWithProviders(<OrderHistoryPage />, '/admin/orders');
    const detail = await openDetail('A-39');
    await userEvent.click(within(detail).getByRole('button', { name: '주문 취소 / 환불' }));
    const dialog = await screen.findByRole('dialog', { name: 'A-39 주문 취소 / 환불' });
    await userEvent.click(within(dialog).getByRole('button', { name: '주문 취소 및 환불' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('취소 사유를 입력해 주세요');
    expect(fake.calls.rpc.some((call) => call.name === 'staff_cancel_order')).toBe(false);

    await userEvent.type(within(dialog).getByLabelText('취소 사유'), '고객 요청');
    await userEvent.click(within(dialog).getByRole('button', { name: '주문 취소 및 환불' }));
    await waitFor(() =>
      expect(fake.calls.rpc).toContainEqual({
        name: 'staff_cancel_order',
        args: {
          p_order_id: FAKE_ORDER_IDS.accepted,
          p_expected_status: 'ACCEPTED',
          p_reason: '고객 요청',
        },
      }),
    );
    expect(fake.calls.functions).toContainEqual({
      name: 'payments-refund',
      body: { orderId: FAKE_ORDER_IDS.accepted },
    });
    expect(await screen.findByText(/A-39 주문을 취소하고 환불을 시작했어요/)).toBeInTheDocument();
  });

  it('shows the server message when the order changed in the meantime', async () => {
    const { fake } = renderWithProviders(<OrderHistoryPage />, '/admin/orders');
    fake.failWith('staff_cancel_order', 'STALE_STATUS');
    const detail = await openDetail('A-39');
    await userEvent.click(within(detail).getByRole('button', { name: '주문 취소 / 환불' }));
    const dialog = await screen.findByRole('dialog', { name: 'A-39 주문 취소 / 환불' });
    await userEvent.type(within(dialog).getByLabelText('취소 사유'), '사유');
    await userEvent.click(within(dialog).getByRole('button', { name: '주문 취소 및 환불' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '주문 상태가 이미 바뀌었어요',
    );
  });
});
