import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { OrderStatusTracker } from '@/components/order/OrderStatusTracker';
import { PaymentStatusView } from '@/components/order/PaymentStatusView';
import { PointCodeFeedback } from '@/components/reward/PointCodeFeedback';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import type { QueryState } from '@/lib/queryState';

function renderBoundary(state: QueryState<string[]>) {
  return render(
    <QueryBoundary state={state} isEmpty={isEmptyList} emptyMessage="비어 있어요">
      {(items) => <Text>{items.join(',')}</Text>}
    </QueryBoundary>,
  );
}

describe('QueryBoundary', () => {
  it('renders loading', async () => {
    await renderBoundary({ status: 'loading' });
    expect(screen.getByLabelText('불러오는 중이에요')).toBeOnTheScreen();
  });

  it('renders error with a working retry', async () => {
    const refetch = jest.fn();
    await renderBoundary({ status: 'error', message: '불러오지 못했어요', refetch });
    expect(screen.getByText('불러오지 못했어요')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders empty', async () => {
    await renderBoundary({ status: 'success', data: [] });
    expect(screen.getByText('비어 있어요')).toBeOnTheScreen();
  });

  it('renders success', async () => {
    await renderBoundary({ status: 'success', data: ['a', 'b'] });
    expect(screen.getByText('a,b')).toBeOnTheScreen();
  });
});

describe('status views', () => {
  it('shows text status, not color only, for rejected orders', async () => {
    await render(<OrderStatusTracker status="REJECTED" />);
    expect(screen.getByText('주문 거절')).toBeOnTheScreen();
  });

  it('marks the current order step in text', async () => {
    await render(<OrderStatusTracker status="PREPARING" />);
    expect(screen.getByLabelText('제조 중, 진행 중')).toBeOnTheScreen();
    expect(screen.getByLabelText('주문 접수, 완료')).toBeOnTheScreen();
  });

  it('renders every point-code outcome', async () => {
    for (const status of ['invalid', 'duplicate', 'expired'] as const) {
      const view = await render(<PointCodeFeedback result={{ status }} />);
      expect(screen.getByText('등록 실패')).toBeOnTheScreen();
      await view.unmount();
    }
    await render(<PointCodeFeedback result={{ status: 'registered' }} />);
    expect(screen.getByText('등록 완료')).toBeOnTheScreen();
  });

  it('offers retry after a failed payment', async () => {
    const onRetry = jest.fn();
    await render(<PaymentStatusView phase="failed" onRetry={onRetry} />);
    await fireEvent.press(screen.getByLabelText('다시 결제하기'));
    expect(onRetry).toHaveBeenCalled();
  });
});
