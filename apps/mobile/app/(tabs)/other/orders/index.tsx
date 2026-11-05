import { useRouter } from 'expo-router';
import { Receipt } from 'lucide-react-native';

import { OrderRow } from '@/components/other/OrderRow';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useOrdersQuery } from '@/fixtures/queries';

export default function OrdersScreen() {
  const router = useRouter();
  const state = useOrdersQuery();
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
        {(orders) =>
          orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onPress={() =>
                router.push({ pathname: '/other/orders/[orderId]', params: { orderId: order.id } })
              }
            />
          ))
        }
      </QueryBoundary>
    </Screen>
  );
}
