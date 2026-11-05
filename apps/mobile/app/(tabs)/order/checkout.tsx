import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { AmountSummary } from '@/components/order/AmountSummary';
import { CouponPicker, PointToggle } from '@/components/order/CheckoutOptions';
import { OrderLinesCard } from '@/components/order/OrderLinesCard';
import { PaymentMethodPicker } from '@/components/order/PaymentMethodPicker';
import { PaymentStatusView, type PaymentPhase } from '@/components/order/PaymentStatusView';
import { CtaButton } from '@/components/ui/CtaButton';
import { FormSection } from '@/components/ui/FormSection';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { submitFixtureOrder } from '@/fixtures/actions';
import { useCouponsQuery, useMenuQuery, usePointsQuery } from '@/fixtures/queries';
import { displaySubtotal, joinCartLines, previewCheckoutAmounts } from '@/lib/displayTotals';
import { formatWon } from '@/lib/format';
import { combineStates } from '@/lib/queryState';
import type { Coupon, MenuItem, PaymentMethod, PointSummary } from '@/models';
import { useCartStore } from '@/store/useCartStore';

type Props = { menu: MenuItem[]; coupons: Coupon[]; points: PointSummary };

function Checkout({ menu, coupons, points }: Props) {
  const router = useRouter();
  const { lines, orderType } = useCartStore();
  const [couponId, setCouponId] = useState<string | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phase, setPhase] = useState<PaymentPhase>('idle');
  // Guards double taps; a real implementation also sends an idempotency key (PAY-07).
  const inFlight = useRef(false);

  const entries = joinCartLines(lines, menu);
  const coupon = coupons.find((candidate) => candidate.id === couponId);
  const amounts = previewCheckoutAmounts(
    displaySubtotal(entries),
    coupon?.discountAmount ?? 0,
    points.balance,
    usePoints,
  );

  const pay = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase('processing');
    try {
      const { orderId } = await submitFixtureOrder();
      router.replace({ pathname: '/order/complete/[orderId]', params: { orderId } });
    } catch (error) {
      console.error('checkout: payment request failed', error);
      setPhase('failed');
    } finally {
      inFlight.current = false;
    }
  };

  if (phase !== 'idle') {
    return (
      <Screen>
        <PaymentStatusView phase={phase} onRetry={() => setPhase('idle')} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <CtaButton
          label={`${formatWon(amounts.finalAmount)} 결제하기`}
          onPress={pay}
          isDisabled={entries.length === 0 || method === null}
          accessibilityHint={method === null ? '결제수단을 먼저 선택해 주세요' : undefined}
        />
      }
    >
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
      <CouponPicker coupons={coupons} selectedId={couponId} onSelect={setCouponId} />
      <PointToggle balance={points.balance} enabled={usePoints} onChange={setUsePoints} />
      <PaymentMethodPicker selected={method} onSelect={setMethod} />
      <AmountSummary {...amounts} />
    </Screen>
  );
}

export default function CheckoutScreen() {
  const state = combineStates(combineStates(useMenuQuery(), useCouponsQuery()), usePointsQuery());
  return (
    <QueryBoundary state={state} emptyMessage="">
      {([[menu, coupons], points]) => <Checkout menu={menu} coupons={coupons} points={points} />}
    </QueryBoundary>
  );
}
