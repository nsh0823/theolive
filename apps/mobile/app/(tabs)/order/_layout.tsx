import { Stack } from 'expo-router';

import { CartButton } from '@/components/order/CartButton';
import { AppStack } from '@/components/ui/AppStack';

export default function OrderLayout() {
  return (
    <AppStack>
      <Stack.Screen
        name="index"
        options={{ title: '오더', headerLargeTitle: true, headerRight: () => <CartButton /> }}
      />
      <Stack.Screen name="item/[id]" options={{ title: '메뉴 상세' }} />
      <Stack.Screen name="cart" options={{ title: '장바구니' }} />
      <Stack.Screen name="order-type" options={{ title: '주문 방식' }} />
      <Stack.Screen name="checkout" options={{ title: '결제하기' }} />
      <Stack.Screen
        name="complete/[orderId]"
        options={{ title: '주문 완료', headerBackVisible: false, gestureEnabled: false }}
      />
    </AppStack>
  );
}
