import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setConnected } from '@/data/actions';
import { menuStore, ordersStore } from '@/data/stores';
import { ORDER_STATUS } from '@/domain/models';
import { renderWithProviders } from '@/test/render';
import { OrdersPage } from './OrdersPage';

function column(name: string): HTMLElement {
  return screen.getByRole('region', { name: new RegExp(name) });
}

describe('OrdersPage (Store Web board)', () => {
  it('shows the four columns in order with new orders and the new-order indicator', async () => {
    renderWithProviders(<OrdersPage />, '/orders');
    expect(await screen.findByRole('region', { name: /신규 주문/ })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim());
    expect(headings.slice(0, 4)).toEqual(['신규 주문', '접수 완료', '준비 중', '준비 완료']);
    expect(
      within(column('신규 주문')).getByRole('article', { name: 'A-41 주문' }),
    ).toBeInTheDocument();
    expect(screen.getByText('신규 주문 3건')).toBeInTheDocument();
  });

  it('moves an order forward only through valid steps', async () => {
    renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.click(screen.getByRole('button', { name: 'A-41 접수하기' }));
    expect(
      within(column('접수 완료')).getByRole('article', { name: 'A-41 주문' }),
    ).toBeInTheDocument();
    expect(screen.getByText('신규 주문 2건')).toBeInTheDocument();
    expect(
      within(column('접수 완료')).getByRole('button', { name: 'A-41 준비 시작' }),
    ).toBeInTheDocument();
  });

  it('rejects through the detail drawer and a confirm dialog with a reason', async () => {
    renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-40 주문' });
    await userEvent.click(
      within(screen.getByRole('article', { name: 'A-40 주문' })).getByText('카페 라떼'),
    );
    const drawer = await screen.findByRole('dialog', { name: '주문 A-40' });
    await userEvent.click(within(drawer).getByRole('button', { name: '주문 거절' }));
    const confirm = await screen.findByRole('dialog', { name: /거절할까요/ });
    await userEvent.click(within(confirm).getByRole('radio', { name: '영업 종료' }));
    await userEvent.click(within(confirm).getByRole('button', { name: '주문 거절' }));
    const order = ordersStore.get().find((o) => o.orderNumber === 'A-40');
    expect(order?.status).toBe(ORDER_STATUS.REJECTED);
    expect(order?.rejectReason).toBe('영업 종료');
    expect(screen.queryByRole('article', { name: 'A-40 주문' })).not.toBeInTheDocument();
  });

  it('shows the realtime-disconnected banner and refetches on reconnect', async () => {
    renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    act(() => setConnected(false));
    expect(screen.getByRole('alert')).toHaveTextContent('실시간 연결이 끊겼어요');
    await userEvent.click(screen.getByRole('button', { name: '지금 다시 연결' }));
    expect(screen.queryByText(/실시간 연결이 끊겼어요/)).not.toBeInTheDocument();
  });

  it('toggles sold-out from the quick controls without leaving the board', async () => {
    renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.click(screen.getByRole('button', { name: /품절 관리/ }));
    const drawer = await screen.findByRole('dialog', { name: '빠른 매장 설정' });
    await userEvent.click(
      await within(drawer).findByRole('switch', { name: '품절 처리: 아메리카노' }),
    );
    expect(menuStore.get().find((item) => item.id === 'americano')?.isSoldOut).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles store open and order acceptance', async () => {
    renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.click(screen.getByRole('button', { name: /매장 상태/ }));
    await userEvent.click(await screen.findByRole('switch', { name: /주문 접수: 접수 가능/ }));
    expect(screen.getByRole('switch', { name: /주문 접수: 일시 중지/ })).toBeInTheDocument();
  });
});
