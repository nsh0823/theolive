import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { Pressable, View } from 'react-native';

import { formatWon } from '@/lib/format';
import { TEMPERATURE_LABEL } from '@/lib/labels';
import type { MenuItem } from '@/models';

import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';
import { Thumbnail } from '../ui/Thumbnail';

type Props = { item: MenuItem; onPress: (item: MenuItem) => void };

/** DESIGN.md menu card: text on the left, 80px thumbnail on the right. */
export function MenuItemCard({ item, onPress }: Props) {
  const temperatures = item.temperatures.map((t) => TEMPERATURE_LABEL[t]).join(' / ');
  const label = `${item.name}, ${formatWon(item.price)}, ${temperatures}${item.isSoldOut ? ', 품절' : ''}`;
  return (
    <Pressable onPress={() => onPress(item)} accessibilityRole="button" accessibilityLabel={label}>
      <Card className={`flex-row items-center gap-3 ${item.isSoldOut ? 'opacity-60' : ''}`}>
        <View className="flex-1 gap-1">
          <Heading size="sm">{item.name}</Heading>
          <Text size="sm" numberOfLines={2} className="text-muted-foreground">
            {item.description}
          </Text>
          <View className="flex-row items-center gap-2 pt-1">
            <Text className="font-bold">{formatWon(item.price)}</Text>
            {item.isSoldOut ? <Pill label="품절" tone="danger" /> : <Pill label={temperatures} />}
          </View>
        </View>
        <Thumbnail />
      </Card>
    </Pressable>
  );
}
