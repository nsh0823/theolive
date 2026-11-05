import { Text } from '@theolive/ui/components/text';
import { BellOff, Megaphone, Package } from 'lucide-react-native';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { AppIcon } from '@/components/ui/AppIcon';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useNotificationsQuery } from '@/fixtures/queries';

export default function NotificationsScreen() {
  const state = useNotificationsQuery();
  return (
    <Screen>
      <QueryBoundary
        state={state}
        isEmpty={isEmptyList}
        emptyMessage="새로운 알림이 없어요."
        emptyIcon={BellOff}
      >
        {(items) =>
          items.map((item) => (
            <Card
              key={item.id}
              className="flex-row items-start gap-3"
              accessible
              accessibilityLabel={`${item.kind === 'ORDER' ? '주문 알림' : '공지'}, ${item.title}, ${item.at}`}
            >
              <AppIcon icon={item.kind === 'ORDER' ? Package : Megaphone} tone="primary" />
              <View className="flex-1 gap-1">
                <Text>{item.title}</Text>
                <Text size="xs" className="text-muted-foreground">
                  {item.at}
                </Text>
              </View>
            </Card>
          ))
        }
      </QueryBoundary>
    </Screen>
  );
}
