import { Stack } from 'expo-router';

import { HeaderActions } from '@/components/order/HeaderActions';
import { AppStack } from '@/components/ui/AppStack';

export default function OrderLayout() {
  return (
    <AppStack>
      <Stack.Screen
        name="index"
        options={{ title: '오더', headerRight: () => <HeaderActions /> }}
      />
      <Stack.Screen name="search" options={{ title: '메뉴 검색' }} />
      <Stack.Screen name="item/[id]" options={{ title: '', headerLargeTitle: false }} />
      <Stack.Screen name="cart" options={{ title: '장바구니' }} />
      <Stack.Screen name="order-type" options={{ title: '주문 방식' }} />
      <Stack.Screen name="checkout" options={{ title: '결제하기' }} />
      <Stack.Screen
        name="complete/[orderId]"
        options={{
          title: '결제 완료',
          headerLargeTitle: false,
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </AppStack>
  );
}
