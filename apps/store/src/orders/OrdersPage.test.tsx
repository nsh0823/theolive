import { toStaffAccess } from '@theolive/api';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_STATUS } from '@/auth/accessRules';
import { FAKE_IDS, FAKE_ORDER_IDS, type FakeSupabase } from '@/test/fakeSupabase';
import { renderWithProviders } from '@/test/render';
import { OrdersPage } from './OrdersPage';

function column(name: string): HTMLElement {
  return screen.getByRole('region', { name: new RegExp(name) });
}

function orderRow(fake: FakeSupabase, id: string) {
  const row = fake.tables.orders?.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`seed order ${id} missing`);
  return row;
}

function transitionCalls(fake: FakeSupabase) {
  return fake.calls.rpc.filter((call) => call.name === 'staff_transition_order');
}

describe('OrdersPage (Store Web board, server data)', () => {
  it('shows the four columns in order with new orders and the new-order indicator', async () => {
    renderWithProviders(<OrdersPage />, '/orders');
    expect(await screen.findByRole('region', { name: /신규 주문/ })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim());
    expect(headings.slice(0, 4)).toEqual(['신규 주문', '접수 완료', '준비 중', '준비 완료']);
    expect(
      await within(column('신규 주문')).findByRole('article', { name: 'A-41 주문' }),
    ).toBeInTheDocument();
    expect(within(column('접수 완료')).getByRole('article', { name: 'A-39 주문' })).toBeVisible();
    expect(screen.getByText('신규 주문 2건')).toBeInTheDocument();
    // Completed and rejected orders are not on the board.
    expect(screen.queryByRole('article', { name: 'A-30 주문' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'A-20 주문' })).not.toBeInTheDocument();
  });

  it('sends the status the tablet shows and moves the order after the board refetches', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.click(screen.getByRole('button', { name: 'A-41 접수하기' }));
    expect(
      await within(column('접수 완료')).findByRole('article', { name: 'A-41 주문' }),
    ).toBeInTheDocument();
    expect(transitionCalls(fake)).toEqual([
      {
        name: 'staff_transition_order',
        args: {
          p_order_id: FAKE_ORDER_IDS.newOrder,
          p_action: 'ACCEPT',
          p_expected_status: 'PAID',
          p_reason_code: undefined,
          p_reason: undefined,
        },
      },
    ]);
    expect(screen.getByText('신규 주문 1건')).toBeInTheDocument();
    expect(
      within(column('접수 완료')).getByRole('button', { name: 'A-41 준비 시작' }),
    ).toBeInTheDocument();
  });

  it('shows a refresh message on STALE_STATUS and refreshes the board to the server state', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    // Another tablet already moved the order on while this one still shows it as new.
    orderRow(fake, FAKE_ORDER_IDS.newOrder).status = 'PREPARING';
    await userEvent.click(screen.getByRole('button', { name: 'A-41 접수하기' }));
    expect(
      await screen.findByText('주문 상태가 이미 바뀌었어요. 새로고침했어요.'),
    ).toBeInTheDocument();
    expect(
      await within(column('준비 중')).findByRole('article', { name: 'A-41 주문' }),
    ).toBeInTheDocument();
  });

  it('treats an action another tablet already applied as done, without an error message', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    orderRow(fake, FAKE_ORDER_IDS.newOrder).status = 'ACCEPTED';
    await userEvent.click(screen.getByRole('button', { name: 'A-41 접수하기' }));
    expect(
      await within(column('접수 완료')).findByRole('article', { name: 'A-41 주문' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/이미 바뀌었어요/)).not.toBeInTheDocument();
    expect(screen.queryByText(/처리했어요/)).not.toBeInTheDocument();
  });

  it('sends one request when a button is double-tapped', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.dblClick(screen.getByRole('button', { name: 'A-41 접수하기' }));
    await within(column('접수 완료')).findByRole('article', { name: 'A-41 주문' });
    expect(transitionCalls(fake)).toHaveLength(1);
  });

  it('rejects through the detail drawer with a reason code, then asks the provider for the refund', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-40 주문' });
    await userEvent.click(
      within(screen.getByRole('article', { name: 'A-40 주문' })).getByText('카페 라떼'),
    );
    const drawer = await screen.findByRole('dialog', { name: '주문 A-40' });
    await userEvent.click(within(drawer).getByRole('button', { name: '주문 거절' }));
    const confirm = await screen.findByRole('dialog', { name: /거절할까요/ });
    await userEvent.click(within(confirm).getByRole('radio', { name: '영업 종료' }));
    await userEvent.click(within(confirm).getByRole('button', { name: '주문 거절' }));
    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'A-40 주문' })).not.toBeInTheDocument(),
    );
    const row = orderRow(fake, FAKE_ORDER_IDS.secondNew);
    expect(row).toMatchObject({ status: 'REJECTED', reject_reason_code: 'CLOSING' });
    expect(fake.calls.functions).toContainEqual({
      name: 'payments-refund',
      body: { orderId: FAKE_ORDER_IDS.secondNew },
    });
  });

  it('shows new orders from a store:orders event with the new-order banner', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    const source = orderRow(fake, FAKE_ORDER_IDS.newOrder);
    fake.tables.orders?.push({ ...source, id: 'order-a42', order_number: 'A-42' });
    act(() => fake.emit('order_paid'));
    expect(await screen.findByRole('article', { name: 'A-42 주문' })).toBeInTheDocument();
    expect(await screen.findByText('새 주문이 들어왔어요')).toBeInTheDocument();
  });

  it('follows the real channel: banner when it drops, refetch when it resubscribes', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    expect(screen.queryByText(/실시간 연결이 끊겼어요/)).not.toBeInTheDocument();
    act(() => fake.setChannelStatus('CLOSED'));
    expect(await screen.findByRole('alert')).toHaveTextContent('실시간 연결이 끊겼어요');
    const source = orderRow(fake, FAKE_ORDER_IDS.newOrder);
    fake.tables.orders?.push({ ...source, id: 'order-a43', order_number: 'A-43' });
    act(() => fake.setChannelStatus('SUBSCRIBED'));
    expect(await screen.findByRole('article', { name: 'A-43 주문' })).toBeInTheDocument();
    expect(screen.queryByText(/실시간 연결이 끊겼어요/)).not.toBeInTheDocument();
  });

  it('shows the banner while the browser is offline', async () => {
    renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    const online = vi.spyOn(window.navigator, 'onLine', 'get');
    online.mockReturnValue(false);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(await screen.findByRole('alert')).toHaveTextContent('실시간 연결이 끊겼어요');
    online.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() =>
      expect(screen.queryByText(/실시간 연결이 끊겼어요/)).not.toBeInTheDocument(),
    );
    online.mockRestore();
  });

  it('shows an error state with retry when the orders cannot be loaded', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    fake.failWith('read:orders', 'boom');
    expect(await screen.findByText('데이터를 불러오지 못했어요')).toBeInTheDocument();
    fake.clearFailure('read:orders');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('article', { name: 'A-41 주문' })).toBeInTheDocument();
  });

  it('tells staff without PROCESS_ORDERS that they have no access instead of an empty board', () => {
    renderWithProviders(<OrdersPage />, '/orders', {
      status: AUTH_STATUS.SIGNED_IN,
      userId: 'ops-only',
      email: null,
      displayName: '운영',
      access: toStaffAccess({ role: 'STAFF', permissions: ['MANAGE_OPERATIONS'], is_active: true }),
    });
    expect(screen.getByRole('alert')).toHaveTextContent('주문을 처리할 권한이 없어요');
    expect(screen.queryByRole('region', { name: /신규 주문/ })).not.toBeInTheDocument();
  });

  it('toggles sold-out from the quick controls through the server and refetches', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.click(screen.getByRole('button', { name: /품절 관리/ }));
    const drawer = await screen.findByRole('dialog', { name: '빠른 매장 설정' });
    await userEvent.click(
      await within(drawer).findByRole('switch', { name: '품절 처리: 아메리카노' }),
    );
    await waitFor(() =>
      expect(
        fake.tables.menu_items?.find((row) => row.id === FAKE_IDS.americano)?.is_sold_out,
      ).toBe(true),
    );
    expect(
      await within(drawer).findByRole('switch', { name: '품절 처리: 아메리카노', checked: true }),
    ).toBeInTheDocument();
    expect(fake.calls.rpc).toContainEqual({
      name: 'set_menu_item_sold_out',
      args: { p_menu_item_id: FAKE_IDS.americano, p_is_sold_out: true },
    });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the server refusal and keeps the switch unchanged when sold-out is denied', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    fake.failWith('set_menu_item_sold_out', 'FORBIDDEN');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.click(screen.getByRole('button', { name: /품절 관리/ }));
    const drawer = await screen.findByRole('dialog', { name: '빠른 매장 설정' });
    await userEvent.click(
      await within(drawer).findByRole('switch', { name: '품절 처리: 아메리카노' }),
    );
    expect(await screen.findByText('이 작업을 할 권한이 없어요.')).toBeInTheDocument();
    expect(
      within(drawer).getByRole('switch', { name: '품절 처리: 아메리카노', checked: false }),
    ).toBeInTheDocument();
  });

  it('shows an error state with retry when the menu cannot be loaded', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    fake.failWith('read:menu_items', 'boom');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.click(screen.getByRole('button', { name: /품절 관리/ }));
    const drawer = await screen.findByRole('dialog', { name: '빠른 매장 설정' });
    expect(await within(drawer).findByText('데이터를 불러오지 못했어요')).toBeInTheDocument();
  });

  it('refetches the catalog when a store:catalog event arrives', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('button', { name: '품절 관리 (1)' });
    const scone = fake.tables.menu_items?.find((row) => row.name === '플레인 스콘');
    if (!scone) throw new Error('seed row missing');
    scone.is_sold_out = true;
    act(() => fake.emit('menu_updated'));
    expect(await screen.findByRole('button', { name: '품절 관리 (2)' })).toBeInTheDocument();
  });

  it('shows the disconnected banner when the catalog channel drops and refetches on resubscribe', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('button', { name: '품절 관리 (1)' });
    act(() => fake.setChannelStatus('CHANNEL_ERROR'));
    expect(await screen.findByRole('alert')).toHaveTextContent('실시간 연결이 끊겼어요');
    const scone = fake.tables.menu_items?.find((row) => row.name === '플레인 스콘');
    if (!scone) throw new Error('seed row missing');
    scone.is_sold_out = true;
    act(() => fake.setChannelStatus('SUBSCRIBED'));
    expect(await screen.findByRole('button', { name: '품절 관리 (2)' })).toBeInTheDocument();
    expect(screen.queryByText(/실시간 연결이 끊겼어요/)).not.toBeInTheDocument();
  });

  it('toggles store open and order acceptance on the server', async () => {
    const { fake } = renderWithProviders(<OrdersPage />, '/orders');
    await screen.findByRole('article', { name: 'A-41 주문' });
    await userEvent.click(
      await screen.findByRole('button', { name: /매장 상태: 영업 중 · 접수 가능/ }),
    );
    await userEvent.click(await screen.findByRole('switch', { name: /주문 접수: 접수 가능/ }));
    expect(await screen.findByRole('switch', { name: /주문 접수: 일시 중지/ })).toBeInTheDocument();
    expect(fake.tables.store_settings?.[0]?.is_accepting_orders).toBe(false);
    expect(
      await screen.findByRole('button', { name: /매장 상태: 영업 중 · 접수 일시 중지/ }),
    ).toBeInTheDocument();
  });
});
