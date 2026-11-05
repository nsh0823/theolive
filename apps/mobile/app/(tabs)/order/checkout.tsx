import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@theolive/api';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { AmountSummary } from '@/components/order/AmountSummary';
import { CouponPicker, PointsInput } from '@/components/order/CheckoutOptions';
import { OrderLinesCard } from '@/components/order/OrderLinesCard';
import { PaymentMethodPicker } from '@/components/order/PaymentMethodPicker';
import { PaymentStatusView, type PaymentPhase } from '@/components/order/PaymentStatusView';
import { StoreClosedBanner } from '@/components/order/StoreClosedBanner';
import { CtaButton } from '@/components/ui/CtaButton';
import { FormSection } from '@/components/ui/FormSection';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useCheckoutPricing } from '@/hooks/useCheckoutPricing';
import { useMenuQuery } from '@/hooks/useMenu';
import { useCheckoutMutation } from '@/hooks/useOrders';
import { useOrderAvailability } from '@/hooks/useStoreStatus';
import { removeSoldOut } from '@/lib/cartPruning';
import { checkoutFingerprint, toCheckoutInput } from '@/lib/checkoutRequest';
import { displaySubtotal, joinCartLines, previewCheckoutAmounts } from '@/lib/displayTotals';
import {
  makesCouponStale,
  makesMenuStale,
  makesPointsStale,
  userMessage,
} from '@/lib/errorMessage';
import { formatWon } from '@/lib/format';
import type { MenuItem, PaymentMethod } from '@/models';
import { useCartStore } from '@/store/useCartStore';
import { useCheckoutAttemptStore } from '@/store/useCheckoutAttemptStore';

function Checkout({ menu }: { menu: MenuItem[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lines, orderType } = useCartStore();
  const idFor = useCheckoutAttemptStore((state) => state.idFor);
  const resetAttempt = useCheckoutAttemptStore((state) => state.reset);
  const { canOrder } = useOrderAvailability();
  const checkout = useCheckoutMutation();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [failure, setFailure] = useState<string | undefined>(undefined);
  // Ignores a second tap before React has re-rendered the disabled button.
  const inFlight = useRef(false);

  const entries = joinCartLines(lines, menu);
  const hasBlockedLine = removeSoldOut(lines, menu).length !== lines.length;
  const coupon = useCheckoutPricing(lines);
  // The points the server applied; this exact amount is what the order is placed with.
  const pointsToUse = coupon.quote?.pointsUsed ?? 0;
  // Only the menu subtotal is shown until the server answers; the discounts are always the server's numbers.
  const amounts = coupon.quote
    ? {
        menuAmount: coupon.quote.menuAmount,
        couponDiscount: coupon.quote.couponDiscount,
        pointsUsed: coupon.quote.pointsUsed,
        finalAmount: coupon.quote.paidAmount,
      }
    : previewCheckoutAmounts(displaySubtotal(entries), 0, 0, false);

  const pay = async () => {
    if (inFlight.current || method === null) return;
    inFlight.current = true;
    setPhase('processing');
    try {
      const input = toCheckoutInput({
        // One id per distinct request: a retry or double tap replays the same order (PAY-07).
        clientRequestId: idFor(
          checkoutFingerprint(lines, orderType, method, coupon.selectedId, pointsToUse),
        ),
        lines,
        orderType,
        method,
        userCouponId: coupon.selectedId,
        pointsToUse,
      });
      const result = await checkout.mutateAsync(input);
      if (result.nextAction.type === 'TEST_SHEET') {
        setPhase('idle');
        router.push({
          pathname: '/order/pay',
          params: {
            orderId: result.orderId,
            paymentId: result.paymentId,
            amount: String(result.amount),
            checkoutToken: result.nextAction.checkoutToken,
          },
        });
        return;
      }
      if (result.nextAction.type === 'NONE') {
        resetAttempt();
        useCartStore.getState().clear();
        router.replace({
          pathname: '/order/complete/[orderId]',
          params: { orderId: result.orderId },
        });
        return;
      }
      setFailure('이 결제 방식은 아직 지원하지 않아요.');
      setPhase('failed');
    } catch (error) {
      console.error('checkout: request failed', error);
      if (makesMenuStale(error)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.menu.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.store.all });
      }
      if (makesCouponStale(error)) {
        coupon.clear();
        void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all });
      }
      if (makesPointsStale(error)) {
        // The balance changed under us (another order, expiry): ask the server again.
        void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all });
      }
      setFailure(userMessage(error));
      setPhase('failed');
    } finally {
      inFlight.current = false;
    }
  };

  if (phase !== 'idle') {
    return (
      <Screen>
        <PaymentStatusView
          phase={phase}
          message={failure}
          onRetry={() => {
            setFailure(undefined);
            setPhase('idle');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <CtaButton
          label={`${formatWon(amounts.finalAmount)} 결제하기`}
          onPress={pay}
          isDisabled={
            entries.length === 0 ||
            method === null ||
            hasBlockedLine ||
            !canOrder ||
            coupon.isPricing
          }
          accessibilityHint={
            hasBlockedLine
              ? '장바구니에서 주문할 수 없는 메뉴를 먼저 삭제해 주세요'
              : method === null
                ? '결제수단을 먼저 선택해 주세요'
                : undefined
          }
        />
      }
    >
      <StoreClosedBanner />
      <FormSection title="주문 내역">
        <OrderLinesCard
          orderType={orderType}
          lines={entries.map(({ line, item }) => ({
            menuItemId: item.id,
            name: item.name,
            temperature: line.temperature,
            quantity: line.quantity,
            unitPrice: item.price,
          }))}
        />
      </FormSection>
      {coupon.usableCoupons.length > 0 ? (
        <CouponPicker
          coupons={coupon.usableCoupons}
          selectedId={coupon.selectedId}
          onSelect={coupon.select}
        />
      ) : null}
      {coupon.notice ? (
        <Text className="text-destructive" accessibilityRole="alert">
          {coupon.notice}
        </Text>
      ) : null}
      {coupon.pointsAvailable > 0 || coupon.requestedPoints > 0 ? (
        <PointsInput
          available={coupon.pointsAvailable}
          maxUsable={coupon.maxPointsUsable}
          applied={pointsToUse}
          requested={coupon.requestedPoints}
          isPricing={coupon.isPricing}
          onRequest={coupon.requestPoints}
        />
      ) : null}
      <PaymentMethodPicker selected={method} onSelect={setMethod} />
      <AmountSummary {...amounts} />
    </Screen>
  );
}

export default function CheckoutScreen() {
  const menu = useMenuQuery();
  return (
    <QueryBoundary state={menu} emptyMessage="">
      {(items) => <Checkout menu={items} />}
    </QueryBoundary>
  );
}
