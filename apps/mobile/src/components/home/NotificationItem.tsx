import { Text } from '@theolive/ui/components/text';
import {
  Bell,
  CreditCard,
  Megaphone,
  Package,
  Sprout,
  Ticket,
  Coins,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { NOTIFICATION_KIND_LABEL } from '@/lib/labels';
import { NOTIFICATION_KIND, type AppNotification, type NotificationKind } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { Pill } from '../ui/Pill';

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  [NOTIFICATION_KIND.ORDER]: Package,
  [NOTIFICATION_KIND.PAYMENT]: CreditCard,
  [NOTIFICATION_KIND.STAMP]: Sprout,
  [NOTIFICATION_KIND.COUPON]: Ticket,
  [NOTIFICATION_KIND.POINT]: Coins,
  [NOTIFICATION_KIND.NOTICE]: Megaphone,
};

type Props = { item: AppNotification; isRead: boolean; onPress: () => void };

/** Flat row. Unread = bold title + "새 알림" label; read = regular weight, muted text. */
export function NotificationItem({ item, isRead, onPress }: Props) {
  const kindLabel = NOTIFICATION_KIND_LABEL[item.kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isRead ? '읽음' : '읽지 않음'}, ${kindLabel} 알림, ${item.title}, ${item.at}`}
      className="min-h-20 flex-row items-start gap-4 border-b border-border py-4"
    >
      <View className="mt-1 h-10 w-10 items-center justify-center rounded-full border border-sage">
        <AppIcon icon={KIND_ICON[item.kind] ?? Bell} tone="muted" />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Pill label={kindLabel} />
          {!isRead ? <Pill label="새 알림" tone="primary" /> : null}
        </View>
        <Text className={isRead ? 'text-muted-foreground' : 'font-semibold'}>{item.title}</Text>
        <Text size="xs" className="text-muted-foreground">
          {item.at}
        </Text>
      </View>
    </Pressable>
  );
}
