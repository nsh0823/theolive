import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createOrders } from '@/data/fixtures/orders';
import { ORDER_STATUS, type Order } from '@/domain/models';
import { STAFF_ACTION } from '@/domain/orderTransitions';
import { OrderCard } from './OrderCard';

const NOW = Date.now();

function orderWithStatus(status: Order['status']): Order {
  const found = createOrders(NOW).find((order) => order.status === status);
  if (!found) throw new Error(`fixture missing for ${status}`);
  return found;
}

describe('OrderCard', () => {
  it('shows number, time, type, items with HOT/ICE, note, total and status', () => {
    const order = orderWithStatus(ORDER_STATUS.PAID);
    render(<OrderCard order={order} nowMs={NOW} onSelect={vi.fn()} onAction={vi.fn()} />);
    const card = screen.getByRole('article', { name: `${order.orderNumber} 주문` });
    expect(card).toHaveTextContent(order.orderNumber);
    expect(card).toHaveTextContent(/\d{2}:\d{2} 주문/);
    expect(card).toHaveTextContent('포장');
    expect(card).toHaveTextContent('ICE');
    expect(card).toHaveTextContent('HOT');
    expect(card).toHaveTextContent('× 2');
    expect(card).toHaveTextContent('얼음 적게 부탁드려요');
    expect(card).toHaveTextContent('12,800원');
    expect(card).toHaveTextContent('신규 주문');
  });

  it('marks new orders with a NEW label and elapsed time, but not other statuses', () => {
    const fresh = orderWithStatus(ORDER_STATUS.PAID);
    const { rerender } = render(
      <OrderCard order={fresh} nowMs={NOW} onSelect={vi.fn()} onAction={vi.fn()} />,
    );
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByText(/경과|방금 전/)).toBeInTheDocument();

    rerender(
      <OrderCard
        order={orderWithStatus(ORDER_STATUS.ACCEPTED)}
        nowMs={NOW}
        onSelect={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });

  it('offers only the next valid action and reports clicks', async () => {
    const onAction = vi.fn();
    const onSelect = vi.fn();
    const order = orderWithStatus(ORDER_STATUS.PAID);
    render(<OrderCard order={order} nowMs={NOW} onSelect={onSelect} onAction={onAction} />);

    expect(screen.queryByRole('button', { name: /주문 거절/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `${order.orderNumber} 접수하기` }));
    expect(onAction).toHaveBeenCalledWith(order, STAFF_ACTION.ACCEPT);

    await userEvent.click(screen.getByText(order.orderNumber));
    expect(onSelect).toHaveBeenCalledWith(order);
  });

  it('has no action for orders that are already completed', () => {
    const done = orderWithStatus(ORDER_STATUS.COMPLETED);
    render(<OrderCard order={done} nowMs={NOW} onSelect={vi.fn()} onAction={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
