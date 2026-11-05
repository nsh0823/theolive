import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createOrders } from '@/data/fixtures/orders';
import { RejectDialog } from './RejectDialog';

const order = createOrders()[0];
if (!order) throw new Error('fixture orders missing');

describe('RejectDialog', () => {
  it('is hidden without an order and is a labelled modal dialog with one', () => {
    const { rerender } = render(
      <RejectDialog order={null} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<RejectDialog order={order} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: `${order.orderNumber} 주문을 거절할까요?` });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('requires a reason before confirming', async () => {
    const onConfirm = vi.fn();
    render(<RejectDialog order={order} onCancel={vi.fn()} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: '주문 거절' }));
    expect(screen.getByRole('alert')).toHaveTextContent('거절 사유를 선택해 주세요');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the chosen preset reason', async () => {
    const onConfirm = vi.fn();
    render(<RejectDialog order={order} onCancel={vi.fn()} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('radio', { name: '재고 부족 (품절)' }));
    await userEvent.click(screen.getByRole('button', { name: '주문 거절' }));
    expect(onConfirm).toHaveBeenCalledWith('재고 부족 (품절)');
  });

  it('needs text for the "other" reason', async () => {
    const onConfirm = vi.fn();
    render(<RejectDialog order={order} onCancel={vi.fn()} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('radio', { name: '기타 (직접 입력)' }));
    await userEvent.click(screen.getByRole('button', { name: '주문 거절' }));
    expect(screen.getByRole('alert')).toHaveTextContent('기타 사유를 입력해 주세요');
    await userEvent.type(screen.getByLabelText('기타 사유'), '  기계 점검  ');
    await userEvent.click(screen.getByRole('button', { name: '주문 거절' }));
    expect(onConfirm).toHaveBeenCalledWith('기계 점검');
  });

  it('cancels with the button and with Escape, and traps Tab inside the dialog', async () => {
    const onCancel = vi.fn();
    render(<RejectDialog order={order} onCancel={onCancel} onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);

    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 12; i += 1) {
      await userEvent.tab();
      expect(dialog).toContainElement(
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
      );
    }
  });
});
