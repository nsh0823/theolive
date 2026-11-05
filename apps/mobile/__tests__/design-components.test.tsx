import { fireEvent, render, screen } from '@testing-library/react-native';

import { AddToCartSheet } from '@/components/order/AddToCartSheet';
import { PaymentMethodPicker } from '@/components/order/PaymentMethodPicker';
import { BiometricUnavailable } from '@/components/other/BiometricUnavailable';
import { PinPad } from '@/components/other/PinPad';
import { NotificationItem } from '@/components/home/NotificationItem';
import { CouponCard } from '@/components/reward/CouponCard';
import { PointBalanceCard } from '@/components/reward/PointBalanceCard';
import { StampCard } from '@/components/reward/StampCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import type { QueryState } from '@/lib/queryState';
import { FIXTURE_COUPONS, FIXTURE_NOTIFICATIONS } from '@/fixtures/data';

function at<T>(list: T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error(`fixture index ${index} missing`);
  return value;
}

describe('ConfirmDialog', () => {
  it('fires confirm and cancel', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <ConfirmDialog
        visible
        title="교환할까요?"
        confirmLabel="교환하기"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await fireEvent.press(screen.getByLabelText('교환하기'));
    await fireEvent.press(screen.getByLabelText('취소'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it('renders nothing when hidden', async () => {
    await render(
      <ConfirmDialog
        visible={false}
        title="숨김"
        confirmLabel="확인"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByText('숨김')).not.toBeOnTheScreen();
  });
});

describe('AddToCartSheet', () => {
  it('offers go-to-cart and continue actions', async () => {
    const onGoToCart = jest.fn();
    const onContinue = jest.fn();
    await render(
      <AddToCartSheet
        visible
        summary="아메리카노 · HOT · 1개"
        onGoToCart={onGoToCart}
        onContinue={onContinue}
      />,
    );
    await fireEvent.press(screen.getByLabelText('장바구니로 이동하기'));
    await fireEvent.press(screen.getByLabelText('계속 주문하기'));
    expect(onGoToCart).toHaveBeenCalled();
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('PaymentMethodPicker', () => {
  it('lists the wallet options and reports selection', async () => {
    const onSelect = jest.fn();
    await render(<PaymentMethodPicker selected="KAKAO_PAY" onSelect={onSelect} />);
    expect(screen.getByLabelText('카카오페이')).toBeOnTheScreen();
    expect(screen.getByLabelText('네이버페이')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('토스페이'));
    expect(onSelect).toHaveBeenCalledWith('TOSS_PAY');
  });
});

describe('reward cards', () => {
  it('keeps stamps and points as separate labelled cards', async () => {
    await render(
      <>
        <StampCard stamps={{ count: 7, goal: 10 }} />
        <PointBalanceCard points={{ balance: 12000 }} />
      </>,
    );
    expect(screen.getByLabelText(/올리브 스탬프 7개.*다음 보상까지 3개/)).toBeOnTheScreen();
    expect(screen.getByLabelText('쿠폰 포인트 잔액 12,000원')).toBeOnTheScreen();
  });
  it('says when a reward can be exchanged', async () => {
    await render(<StampCard stamps={{ count: 10, goal: 10 }} variant="compact" />);
    expect(screen.getByText('쿠폰으로 교환할 수 있어요')).toBeOnTheScreen();
  });
  it('shows coupon status as text', async () => {
    await render(<CouponCard coupon={at(FIXTURE_COUPONS, 1)} />);
    expect(screen.getByText('사용 완료')).toBeOnTheScreen();
  });
});

describe('NotificationItem', () => {
  it('marks unread in text and not only by style', async () => {
    const onPress = jest.fn();
    await render(
      <NotificationItem item={at(FIXTURE_NOTIFICATIONS, 0)} isRead={false} onPress={onPress} />,
    );
    expect(screen.getByText('새 알림')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^읽지 않음, 주문 알림/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(/^읽지 않음/));
    expect(onPress).toHaveBeenCalled();
  });
  it('reads as 읽음 once read', async () => {
    await render(
      <NotificationItem item={at(FIXTURE_NOTIFICATIONS, 0)} isRead onPress={jest.fn()} />,
    );
    expect(screen.queryByText('새 알림')).not.toBeOnTheScreen();
    expect(screen.getByLabelText(/^읽음, 주문 알림/)).toBeOnTheScreen();
  });
});

describe('security settings UI', () => {
  it('PinPad reports digits and delete', async () => {
    const onDigit = jest.fn();
    const onDelete = jest.fn();
    await render(<PinPad entryLength={2} onDigit={onDigit} onDelete={onDelete} />);
    await fireEvent.press(screen.getByLabelText('7'));
    await fireEvent.press(screen.getByLabelText('지우기'));
    expect(onDigit).toHaveBeenCalledWith('7');
    expect(onDelete).toHaveBeenCalled();
    expect(screen.getByLabelText('4자리 중 2자리 입력됨')).toBeOnTheScreen();
  });
  it('explains why biometrics are unavailable', async () => {
    await render(<BiometricUnavailable status="NOT_ENROLLED" />);
    expect(screen.getByText('생체 인증을 사용할 수 없어요')).toBeOnTheScreen();
    expect(screen.getByText(/등록된 Face ID나 지문이 없어요/)).toBeOnTheScreen();
  });
});

describe('QueryBoundary offline', () => {
  it('shows the disconnected state with retry', async () => {
    const refetch = jest.fn();
    const state: QueryState<string[]> = { status: 'offline', refetch };
    await render(
      <QueryBoundary state={state} emptyMessage="비어 있어요">
        {() => null}
      </QueryBoundary>,
    );
    expect(screen.getByText('인터넷에 연결되어 있지 않아요')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('다시 연결하기'));
    expect(refetch).toHaveBeenCalled();
  });
});
