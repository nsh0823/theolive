import { Text } from '@theolive/ui/components/text';
import { Pressable, View } from 'react-native';

import { AppIcon } from '../ui/AppIcon';
import type { LinkItem } from './LinkGrid';

/** Square-ish icon tiles for the most-used account entries (one row of up to three). */
export function ShortcutTiles({ items }: { items: (LinkItem & { onPress: () => void })[] }) {
  return (
    <View className="flex-row gap-3">
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          className="min-h-28 flex-1 items-center justify-center gap-3 rounded-2xl bg-card px-2 active:bg-secondary"
        >
          <AppIcon icon={item.icon} tone="primary" size={28} />
          <Text size="sm" className="text-center font-semibold">
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
