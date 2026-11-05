import { Text } from '@theolive/ui/components/text';
import { Pressable, ScrollView, View } from 'react-native';

import { useReorder } from '@/hooks/useReorder';
import { TEMPERATURE_LABEL } from '@/lib/labels';
import type { RecentOrderLine } from '@/lib/reorder';

import { Thumbnail } from '../ui/Thumbnail';

/** HOME-03: horizontally scrolling quick-order cards, each with a one-tap reorder. */
export function RecentOrderList({ lines }: { lines: RecentOrderLine[] }) {
  const reorder = useReorder();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-5"
      className="-mx-5 grow-0"
    >
      {lines.map((line) => (
        <View key={line.key} className="w-72 overflow-hidden rounded-2xl bg-card">
          <View className="flex-row items-center gap-4 p-4">
            <Thumbnail size="sm" />
            <View className="flex-1 gap-0.5">
              <Text className="font-bold" numberOfLines={1}>
                {line.name}
              </Text>
              <Text size="sm" className="text-muted-foreground">
                {TEMPERATURE_LABEL[line.temperature]} | {line.quantity}개
              </Text>
              <Text size="xs" className="text-muted-foreground">
                {line.placedAt}
              </Text>
            </View>
          </View>
          <View className="items-end border-t border-border px-4 py-2">
            <Pressable
              onPress={() => reorder([line])}
              accessibilityRole="button"
              accessibilityLabel={`${line.name} 다시 주문`}
              className="min-h-11 items-center justify-center rounded-full bg-foreground px-5 active:opacity-80"
            >
              <Text size="sm" className="font-bold text-background">
                바로 주문하기
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
