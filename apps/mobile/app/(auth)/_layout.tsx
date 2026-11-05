import { Stack } from 'expo-router';

import { AppStack } from '@/components/ui/AppStack';

export default function AuthLayout() {
  return (
    <AppStack>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="legal/[id]" options={{ title: '약관 및 정책' }} />
    </AppStack>
  );
}
