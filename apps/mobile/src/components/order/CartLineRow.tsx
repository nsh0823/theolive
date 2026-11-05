import { Text } from '@theolive/ui/components/text';
import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { formatWon } from '@/lib/format';
import { TEMPERATURE_LABEL } from '@/lib/labels';
import type { DisplayCartLine } from '@/lib/displayTotals';
import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from '@/store/useCartStore';

import { AppIcon } from '../ui/AppIcon';
import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';
import { QuantityStepper } from '../ui/QuantityStepper';
import { Thumbnail } from '../ui/Thumbnail';

type Props = {
  entry: DisplayCartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

export function CartLineRow({ entry, onQuantityChange, onRemove }: Props) {
  const { line, item } = entry;
  const temperature = TEMPERATURE_LABEL[line.temperature];
  return (
    <Card className="gap-3">
      <View className="flex-row gap-3">
        <Thumbnail size="sm" />
        <View className="flex-1 gap-1">
          <Text className="font-semibold">{item.name}</Text>
          <Text size="sm" className="text-muted-foreground">
            {temperature}
          </Text>
          {item.isSoldOut ? <Pill label="품절 · 삭제 후 주문해 주세요" tone="danger" /> : null}
        </View>
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`${item.name} ${temperature} 삭제`}
          className="h-11 w-11 items-center justify-center"
        >
          <AppIcon icon={X} tone="muted" />
        </Pressable>
      </View>
      <View className="flex-row items-center justify-between">
        <QuantityStepper
          value={line.quantity}
          min={MIN_LINE_QUANTITY}
          max={MAX_LINE_QUANTITY}
          onChange={onQuantityChange}
          itemLabel={`${item.name} ${temperature}`}
        />
        <Text className="font-bold">{formatWon(item.price * line.quantity)}</Text>
      </View>
    </Card>
  );
}
