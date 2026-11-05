import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';

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
                  label="주문 내역 보기"
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
            <View className="items-center gap-2 py-4">
              <AppIcon icon={CircleCheck} tone="primary" size={48} />
              <Heading size="xl">주문이 완료되었어요</Heading>
              <Text className="text-muted-foreground">
                주문번호 {order.orderNumber} · {ORDER_TYPE_LABEL[order.orderType]} ·{' '}
                {formatWon(order.paidAmount)}
              </Text>
            </View>
            <OrderStatusTracker status={order.status} />
          </Screen>
        ) : null
      }
    </QueryBoundary>
  );
}
