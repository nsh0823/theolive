import { Stack } from 'expo-router';

import { AppStack } from '@/components/ui/AppStack';

export default function RewardLayout() {
  return (
    <AppStack>
      <Stack.Screen name="index" options={{ title: '리워드' }} />
      <Stack.Screen name="stamps" options={{ title: '올리브 스탬프' }} />
      <Stack.Screen name="coupons" options={{ title: '보유 쿠폰' }} />
      <Stack.Screen name="points" options={{ title: '쿠폰 포인트' }} />
      <Stack.Screen name="point-code" options={{ title: '포인트 코드 등록' }} />
    </AppStack>
  );
}
