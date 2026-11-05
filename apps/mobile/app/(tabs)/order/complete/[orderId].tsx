import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { OrderLinesCard } from '@/components/order/OrderLinesCard';
import { OrderStatusTracker } from '@/components/order/OrderStatusTracker';
import { AppIcon } from '@/components/ui/AppIcon';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useOrderQuery } from '@/fixtures/queries';
import { useRouteParam } from '@/hooks/useRouteParam';
import { formatWon } from '@/lib/format';
import { ORDER_TYPE_LABEL } from '@/lib/labels';

/** Payment complete + live order status (PAID onward, PRD 7.1). */
export default function OrderCompleteScreen() {
  const router = useRouter();
  const orderId = useRouteParam('orderId') ?? '';
  const state = useOrderQuery(orderId);

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
            <View className="items-center gap-2 py-4" accessibilityRole="summary">
              <AppIcon icon={CircleCheck} tone="primary" size={56} />
              <Heading size="2xl">결제가 완료되었어요</Heading>
              <Text className="text-muted-foreground">
                {ORDER_TYPE_LABEL[order.orderType]} · {formatWon(order.paidAmount)}
              </Text>
              <View className="mt-2 items-center rounded-2xl bg-cream px-8 py-4">
                <Text size="xs" className="text-muted-foreground">
                  주문번호
                </Text>
                <Text size="3xl" className="font-bold text-primary">
                  {order.orderNumber}
                </Text>
              </View>
            </View>
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
