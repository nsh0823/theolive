import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { AppIcon } from '../ui/AppIcon';

/** HOME-01: header entry to the notification list. */
export function NotificationBell() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/home/notifications')}
      accessibilityRole="button"
      accessibilityLabel="알림"
      className="h-11 w-11 items-center justify-center"
    >
      <AppIcon icon={Bell} tone="primary" />
    </Pressable>
  );
}
