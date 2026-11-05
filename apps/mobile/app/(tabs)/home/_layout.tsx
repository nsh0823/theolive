import { Stack } from 'expo-router';

import { NotificationBell } from '@/components/home/NotificationBell';
import { AppStack } from '@/components/ui/AppStack';

/** Home has no title or logo in the header: the greeting in the page is the hero. */
export default function HomeLayout() {
  return (
    <AppStack>
      <Stack.Screen
        name="index"
        options={{
          title: '홈',
          headerTitle: '',
          headerLargeTitle: false,
          headerRight: () => <NotificationBell />,
        }}
      />
      <Stack.Screen name="notifications" options={{ title: '알림' }} />
    </AppStack>
  );
}
