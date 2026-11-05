import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';

import { CancelOrderControl } from '@/components/order/CancelOrderControl';
import { useReorder } from '@/hooks/useReorder';
import { CtaButton } from '@/components/ui/CtaButton';
import { AmountSummary } from '@/components/order/AmountSummary';
import { OrderLinesCard } from '@/components/order/OrderLinesCard';
import { OrderStatusTracker } from '@/components/order/OrderStatusTracker';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useOrderQuery } from '@/hooks/useOrders';
import { formatDateTime } from '@/lib/format';
import { refundNote } from '@/lib/labels';
import { useRouteParam } from '@/hooks/useRouteParam';

/** OTH-02: items, options, order type, payment breakdown. */
export default function OrderDetailScreen() {
  const orderId = useRouteParam('orderId') ?? '';
  const state = useOrderQuery(orderId);
  const reorder = useReorder();
  return (
    <QueryBoundary
      state={state}
      isEmpty={(order) => order === null}
      emptyMessage="주문을 찾을 수 없어요."
    >
      {(order) =>
        order ? (
          <Screen
            footer={
              <>
                <CancelOrderControl order={order} />
                <CtaButton label="다시 주문" onPress={() => reorder(order.lines)} />
              </>
            }
          >
            <Text className="text-muted-foreground">
              {formatDateTime(order.placedAt)} · 주문번호 {order.orderNumber ?? '-'}
            </Text>
            {refundNote(order.status, order.paymentStatus) ? (
              <Text className="font-semibold">{refundNote(order.status, order.paymentStatus)}</Text>
            ) : null}
            <OrderStatusTracker status={order.status} />
            <Heading size="sm" accessibilityRole="header">
              주문 메뉴
            </Heading>
            <OrderLinesCard lines={order.lines} orderType={order.orderType} />
            <Heading size="sm" accessibilityRole="header">
              결제 내역
            </Heading>
            <AmountSummary
              menuAmount={order.menuAmount}
              couponDiscount={order.couponDiscount}
              pointsUsed={order.pointsUsed}
              finalAmount={order.paidAmount}
            />
          </Screen>
        ) : null
      }
    </QueryBoundary>
  );
}
