import { Stack } from 'expo-router';

import { AppStack } from '@/components/ui/AppStack';

export default function OtherLayout() {
  return (
    <AppStack>
      <Stack.Screen name="index" options={{ title: '더보기', headerLargeTitle: true }} />
      <Stack.Screen name="orders/index" options={{ title: '주문 내역' }} />
      <Stack.Screen name="orders/[orderId]" options={{ title: '주문 상세' }} />
      <Stack.Screen name="notices/index" options={{ title: '공지사항' }} />
      <Stack.Screen name="notices/[id]" options={{ title: '공지사항' }} />
      <Stack.Screen name="inquiry" options={{ title: '문의하기' }} />
      <Stack.Screen name="notification-settings" options={{ title: '알림 설정' }} />
      <Stack.Screen name="app-lock" options={{ title: '앱 잠금 / 생체 인증' }} />
      <Stack.Screen name="terms/index" options={{ title: '이용약관' }} />
      <Stack.Screen name="terms/[id]" options={{ title: '이용약관' }} />
    </AppStack>
  );
}
