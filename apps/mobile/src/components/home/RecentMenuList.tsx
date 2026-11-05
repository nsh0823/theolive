import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';

import { formatWon } from '@/lib/format';
import type { MenuItem } from '@/models';

import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';
import { Thumbnail } from '../ui/Thumbnail';

/** HOME-03: tapping a recent item opens its detail screen. */
export function RecentMenuList({ items }: { items: MenuItem[] }) {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => router.push({ pathname: '/order/item/[id]', params: { id: item.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${formatWon(item.price)}${item.isSoldOut ? ', 품절' : ''}`}
        >
          <Card className={`w-40 gap-2 ${item.isSoldOut ? 'opacity-60' : ''}`}>
            <Thumbnail />
            <Text className="font-semibold" numberOfLines={1}>
              {item.name}
            </Text>
            {item.isSoldOut ? (
              <Pill label="품절" tone="danger" />
            ) : (
              <Text size="sm" className="font-bold">
                {formatWon(item.price)}
              </Text>
            )}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
