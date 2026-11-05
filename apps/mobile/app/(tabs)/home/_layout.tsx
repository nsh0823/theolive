import { Stack } from 'expo-router';

import { AppStack } from '@/components/ui/AppStack';
import { NotificationBell } from '@/components/home/NotificationBell';

export default function HomeLayout() {
  return (
    <AppStack>
      <Stack.Screen
        name="index"
        options={{
          title: '더올리브',
          headerLargeTitle: true,
          headerRight: () => <NotificationBell />,
        }}
      />
      <Stack.Screen name="notifications" options={{ title: '알림' }} />
    </AppStack>
  );
}
