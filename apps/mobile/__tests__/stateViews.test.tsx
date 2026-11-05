import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppError, PointCodeRejectedError } from '@theolive/api';
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

  it('renders every point-code outcome in plain language (RW-05, RW-08)', async () => {
    const reasons = [
      ['CODE_INVALID', '올바르지 않은 코드예요. 코드를 다시 확인해 주세요.'],
      ['CODE_ALREADY_REGISTERED', '이미 사용된 코드예요.'],
      ['CODE_EXPIRED', '유효기간이 지난 코드예요.'],
      ['CODE_VOID', '사용할 수 없는 코드예요. 매장에 문의해 주세요.'],
    ] as const;
    for (const [code, message] of reasons) {
      const view = await render(
        <PointCodeFeedback result={{ status: 'failed', error: new AppError(code) }} />,
      );
      expect(screen.getByText('등록 실패')).toBeOnTheScreen();
      expect(screen.getByText(message)).toBeOnTheScreen();
      await view.unmount();
    }
    const limited = await render(
      <PointCodeFeedback
        result={{ status: 'failed', error: new PointCodeRejectedError('TOO_MANY_ATTEMPTS', 421) }}
      />,
    );
    expect(
      screen.getByText('코드를 여러 번 잘못 입력했어요. 8분 뒤에 다시 시도해 주세요.'),
    ).toBeOnTheScreen();
    await limited.unmount();
    await render(<PointCodeFeedback result={{ status: 'registered', amount: 5000 }} />);
    expect(screen.getByText('등록 완료')).toBeOnTheScreen();
    expect(screen.getByText(/5,000원이 적립되었어요/)).toBeOnTheScreen();
  });

  it('offers retry after a failed payment', async () => {
    const onRetry = jest.fn();
    await render(<PaymentStatusView phase="failed" onRetry={onRetry} />);
    await fireEvent.press(screen.getByLabelText('다시 결제하기'));
    expect(onRetry).toHaveBeenCalled();
  });
});
