import { Text } from '@theolive/ui/components/text';
import { Pressable, View } from 'react-native';

import { formatWon } from '@/lib/format';
import { TEMPERATURE_LABEL } from '@/lib/labels';
import type { MenuItem } from '@/models';

import { Thumbnail } from '../ui/Thumbnail';

type Props = { item: MenuItem; onPress: (item: MenuItem) => void };

function Tag({ label, danger = false }: { label: string; danger?: boolean }) {
  return (
    <View
      className={`rounded-sm border px-1.5 py-0.5 ${danger ? 'border-destructive' : 'border-primary'}`}
    >
      <Text size="xs" className={`font-semibold ${danger ? 'text-destructive' : 'text-primary'}`}>
        {label}
      </Text>
    </View>
  );
}

/** Flat menu row: round thumbnail, tags, name, description, price. No card chrome. */
export function MenuItemCard({ item, onPress }: Props) {
  const temperatures = item.temperatures.map((t) => TEMPERATURE_LABEL[t]).join(' / ');
  const temperatureNote = temperatures === '' ? '' : `, ${temperatures}`;
  const label = `${item.name}, ${formatWon(item.price)}${temperatureNote}${item.isSoldOut ? ', 품절' : ''}`;
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`min-h-24 flex-row items-center gap-4 py-2 ${item.isSoldOut ? 'opacity-60' : ''}`}
    >
      <Thumbnail imageUrl={item.imageUrl} />
      <View className="flex-1 gap-1">
        <View className="flex-row gap-1.5">
          {item.isSoldOut ? <Tag label="품절" danger /> : null}
          {!item.isSoldOut && temperatures !== '' ? <Tag label={temperatures} /> : null}
        </View>
        <Text size="lg" className="font-bold" numberOfLines={1}>
          {item.name}
        </Text>
        <Text size="sm" numberOfLines={1} className="text-muted-foreground">
          {item.description}
        </Text>
        <Text className="font-bold">{formatWon(item.price)}</Text>
      </View>
    </Pressable>
  );
}
