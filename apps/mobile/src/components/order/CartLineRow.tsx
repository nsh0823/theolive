import { Text } from '@theolive/ui/components/text';
import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { formatWon } from '@/lib/format';
import { TEMPERATURE_LABEL, temperatureText } from '@/lib/labels';
import type { Temperature } from '@/models';
import type { DisplayCartLine } from '@/lib/displayTotals';
import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from '@/store/useCartStore';

import { Chip } from '../ui/Chip';
import { AppIcon } from '../ui/AppIcon';
import { Pill } from '../ui/Pill';
import { QuantityStepper } from '../ui/QuantityStepper';
import { Thumbnail } from '../ui/Thumbnail';

type Props = {
  entry: DisplayCartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onChangeTemperature: (temperature: Temperature) => void;
};

export function CartLineRow({ entry, onQuantityChange, onRemove, onChangeTemperature }: Props) {
  const { line, item } = entry;
  const temperature = temperatureText(line.temperature);
  const nameWithTemperature = [item.name, temperature].filter((part) => part !== '').join(' ');
  return (
    <View className="gap-3 border-b border-border pb-5 pt-2">
      <View className="flex-row gap-4">
        <Thumbnail size="xl" imageUrl={item.imageUrl} />
        <View className="flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text size="lg" className="flex-1 font-bold">
              {item.name}
            </Text>
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel={`${nameWithTemperature} 삭제`}
              className="-mr-2 -mt-2 h-11 w-11 items-center justify-center"
            >
              <View className="h-7 w-7 items-center justify-center rounded-full border border-sage">
                <AppIcon icon={X} tone="muted" size={16} />
              </View>
            </Pressable>
          </View>
          <Text size="sm" className="text-muted-foreground">
            {temperature ? `${temperature} | ` : ''}개당 {formatWon(item.price)}
          </Text>
          {item.isSoldOut ? <Pill label="품절 · 삭제 후 주문해 주세요" tone="danger" /> : null}
          <View className="flex-1" />
          <View className="flex-row items-center justify-between">
            <QuantityStepper
              value={line.quantity}
              min={MIN_LINE_QUANTITY}
              max={MAX_LINE_QUANTITY}
              onChange={onQuantityChange}
              itemLabel={nameWithTemperature}
            />
            <Text size="lg" className="font-bold">
              {formatWon(item.price * line.quantity)}
            </Text>
          </View>
        </View>
      </View>
      {item.temperatures.length > 1 ? (
        <View className="flex-row items-center gap-2" accessibilityLabel="옵션 변경">
          <Text size="sm" className="text-muted-foreground">
            옵션 변경
          </Text>
          {item.temperatures.map((option) => (
            <Chip
              key={option}
              label={TEMPERATURE_LABEL[option]}
              selected={option === line.temperature}
              onPress={() => onChangeTemperature(option)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
