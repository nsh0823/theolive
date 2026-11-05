import { Stack } from 'expo-router';

import { AppStack } from '@/components/ui/AppStack';

export default function OtherLayout() {
  return (
    <AppStack>
      <Stack.Screen name="index" options={{ title: '더보기' }} />
      <Stack.Screen name="profile" options={{ title: '프로필 정보' }} />
      <Stack.Screen name="orders/index" options={{ title: '주문 내역' }} />
      <Stack.Screen name="orders/[orderId]" options={{ title: '주문 상세' }} />
      <Stack.Screen name="notices/index" options={{ title: '공지사항' }} />
      <Stack.Screen name="notices/[id]" options={{ title: '공지사항' }} />
      <Stack.Screen name="inquiry" options={{ title: '문의' }} />
      <Stack.Screen name="inquiry-new" options={{ title: '문의하기' }} />
      <Stack.Screen name="notification-settings" options={{ title: '알림 설정' }} />
      <Stack.Screen name="app-lock" options={{ title: '앱 비밀번호 잠금' }} />
      <Stack.Screen name="app-lock-password" options={{ title: '앱 비밀번호 설정' }} />
      <Stack.Screen name="biometric" options={{ title: '생체 인증' }} />
      <Stack.Screen name="terms/index" options={{ title: '약관 및 정책' }} />
      <Stack.Screen name="terms/[id]" options={{ title: '약관 및 정책' }} />
    </AppStack>
  );
}
