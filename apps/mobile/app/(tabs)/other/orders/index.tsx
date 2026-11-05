import { useRouter } from 'expo-router';
import { Receipt } from 'lucide-react-native';
import { View } from 'react-native';

import { useReorder } from '@/hooks/useReorder';
import { OrderRow } from '@/components/other/OrderRow';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useOrdersQuery } from '@/hooks/useOrders';

export default function OrdersScreen() {
  const router = useRouter();
  const state = useOrdersQuery();
  const reorder = useReorder();
  return (
    <Screen>
      <QueryBoundary
        state={state}
        isEmpty={isEmptyList}
        emptyMessage="아직 주문 내역이 없어요."
        emptyIcon={Receipt}
        emptyActionLabel="메뉴 보러 가기"
        onEmptyAction={() => router.push('/order')}
      >
        {(orders) => (
          <View>
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onReorder={(target) => reorder(target.lines)}
                onPress={() =>
                  router.push({
                    pathname: '/other/orders/[orderId]',
                    params: { orderId: order.id },
                  })
                }
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}
