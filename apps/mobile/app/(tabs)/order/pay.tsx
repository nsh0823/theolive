import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import {
  TEST_PG_SCENARIO,
  APP_ERROR,
  type AppErrorCode,
  type TestPgScenario,
} from '@theolive/types';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { CtaButton } from '@/components/ui/CtaButton';
import { Screen } from '@/components/ui/Screen';
import { useConfirmPaymentMutation, useTestPaymentMutation } from '@/hooks/useOrders';
import { useRouteParam } from '@/hooks/useRouteParam';
import { errorCode, userMessage } from '@/lib/errorMessage';
import { formatWon } from '@/lib/format';
import { visibleScenarios } from '@/lib/testPayment';
import { useCartStore } from '@/store/useCartStore';
import { useCheckoutAttemptStore } from '@/store/useCheckoutAttemptStore';

type SheetState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'declined'; message: string }
  | { kind: 'retryConfirm'; providerPaymentKey: string; message: string };

/** The server already settled these; the complete screen shows what really happened. */
const SETTLED_BY_SERVER: readonly AppErrorCode[] = [
  APP_ERROR.PAYMENT_EXPIRED,
  APP_ERROR.PAYMENT_AMOUNT_MISMATCH,
  APP_ERROR.PAYMENT_NOT_APPROVED,
];

const DECLINED_MESSAGE: Record<string, string> = {
  FAILED: '결제에 실패했어요. 주문은 접수되지 않았고 돈은 빠져나가지 않았어요.',
  CANCELLED: '결제를 취소했어요. 주문은 접수되지 않았어요.',
};

/**
 * TEST payment sheet. This is NOT real payment: it stands in for a payment gateway so the whole flow can be
 * tried. Its answer is never proof; the server verifies with the gateway (payments-confirm) before an
 * order counts as paid, and the complete screen shows the server's state.
 */
export default function PayScreen() {
  const router = useRouter();
  const orderId = useRouteParam('orderId') ?? '';
  const paymentId = useRouteParam('paymentId') ?? '';
  const checkoutToken = useRouteParam('checkoutToken') ?? '';
  const amount = Number(useRouteParam('amount') ?? 0);
  const testPay = useTestPaymentMutation();
  const confirm = useConfirmPaymentMutation();
  const resetAttempt = useCheckoutAttemptStore((state) => state.reset);
  const [state, setState] = useState<SheetState>({ kind: 'idle' });
  const busy = useRef(false);

  const goToComplete = () => {
    resetAttempt();
    useCartStore.getState().clear();
    router.replace({ pathname: '/order/complete/[orderId]', params: { orderId } });
  };

  const confirmKey = async (providerPaymentKey: string) => {
    try {
      await confirm.mutateAsync({ paymentId, providerPaymentKey });
      goToComplete();
    } catch (error) {
      console.error('pay: confirm failed', error);
      const code = errorCode(error);
      if (code !== null && SETTLED_BY_SERVER.includes(code)) {
        goToComplete();
        return;
      }
      setState({ kind: 'retryConfirm', providerPaymentKey, message: userMessage(error) });
    }
  };

  const run = async (scenario: TestPgScenario) => {
    if (busy.current) return;
    busy.current = true;
    setState({ kind: 'working' });
    try {
      const decision = await testPay.mutateAsync({ checkoutToken, scenario });
      if (decision.result !== 'APPROVED') {
        // The order is already cancelled on the server, so the next try must be a new order.
        resetAttempt();
        setState({ kind: 'declined', message: DECLINED_MESSAGE[decision.result] ?? '' });
      } else if (decision.providerPaymentKey === null) {
        goToComplete();
      } else {
        await confirmKey(decision.providerPaymentKey);
      }
    } catch (error) {
      console.error('pay: test payment failed', error);
      setState({ kind: 'declined', message: userMessage(error) });
    } finally {
      busy.current = false;
    }
  };

  const isWorking = state.kind === 'working';
  return (
    <Screen>
      <View
        className="gap-2 rounded-xl border border-destructive bg-card p-4"
        accessibilityRole="alert"
      >
        <Text className="font-bold text-destructive">테스트 결제</Text>
        <Text size="sm">
          실제 결제가 아니에요. 돈이 빠져나가지 않아요. 아래 버튼으로 결과를 골라 보세요.
        </Text>
      </View>
      <View className="items-center gap-1 py-4">
        <Text className="text-muted-foreground">결제 금액</Text>
        <Heading size="3xl">{formatWon(amount)}</Heading>
      </View>
      {state.kind === 'declined' || state.kind === 'retryConfirm' ? (
        <Text className="text-center" accessibilityRole="alert">
          {state.message}
        </Text>
      ) : null}
      {state.kind === 'declined' ? (
        <CtaButton label="다시 결제하기" variant="outline" onPress={() => router.back()} />
      ) : null}
      {state.kind === 'retryConfirm' ? (
        <CtaButton
          label="결제 확인 다시 시도"
          onPress={() => {
            if (busy.current) return;
            busy.current = true;
            setState({ kind: 'working' });
            void confirmKey(state.providerPaymentKey).finally(() => {
              busy.current = false;
            });
          }}
        />
      ) : null}
      {state.kind === 'idle' || isWorking ? (
        <View className="gap-3">
          {visibleScenarios(__DEV__).map(({ scenario, label }) => (
            <CtaButton
              key={scenario}
              label={label}
              variant={scenario === TEST_PG_SCENARIO.SUCCESS ? 'primary' : 'outline'}
              isDisabled={isWorking}
              onPress={() => void run(scenario)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
