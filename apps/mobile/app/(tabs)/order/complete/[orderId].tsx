import { Heading } from '@theolive/ui/components/heading';
import { useRouter } from 'expo-router';

import { CancelOrderControl } from '@/components/order/CancelOrderControl';
import { OrderLinesCard } from '@/components/order/OrderLinesCard';
import { OrderResultHeader } from '@/components/order/OrderResultHeader';
import { OrderStatusTracker } from '@/components/order/OrderStatusTracker';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useOrderQuery, useRecoverPayment } from '@/hooks/useOrders';
import { useRouteParam } from '@/hooks/useRouteParam';
import { ORDER_STATUS } from '@/models';

/**
 * Live order status after paying (PAID onward, PRD 7.1). Everything shown is the server's state; while the
 * payment is still unconfirmed (app was killed, webhook late) the server is asked directly to settle it.
 */
export default function OrderCompleteScreen() {
  const router = useRouter();
  const orderId = useRouteParam('orderId') ?? '';
  const state = useOrderQuery(orderId);
  const isUnpaid =
    state.status === 'success' && state.data?.status === ORDER_STATUS.PENDING_PAYMENT;
  useRecoverPayment(orderId, isUnpaid);

  return (
    <QueryBoundary
      state={state}
      isEmpty={(order) => order === null}
      emptyMessage="주문 정보를 찾을 수 없어요."
    >
      {(order) =>
        order ? (
          <Screen
            footer={
              <>
                <CancelOrderControl order={order} />
                <CtaButton
                  label="주문 상세 보기"
                  onPress={() =>
                    router.replace({
                      pathname: '/other/orders/[orderId]',
                      params: { orderId: order.id },
                    })
                  }
                />
                <CtaButton
                  label="홈으로"
                  variant="secondary"
                  onPress={() => router.replace('/home')}
                />
              </>
            }
          >
            <OrderResultHeader order={order} />
            <OrderStatusTracker status={order.status} />
            <Heading size="sm" accessibilityRole="header">
              주문 내역
            </Heading>
            <OrderLinesCard lines={order.lines} orderType={order.orderType} />
          </Screen>
        ) : null
      }
    </QueryBoundary>
  );
}
