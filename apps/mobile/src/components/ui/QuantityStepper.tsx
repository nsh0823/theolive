import { Text } from '@theolive/ui/components/text';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppIcon } from './AppIcon';

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  itemLabel: string;
};

/** DESIGN.md stepper: Pale Olive pill, 44pt buttons. */
export function QuantityStepper({ value, min, max, onChange, itemLabel }: Props) {
  const canDecrease = value > min;
  const canIncrease = value < max;
  return (
    <View className="flex-row items-center rounded-full bg-secondary">
      <Pressable
        onPress={() => onChange(value - 1)}
        disabled={!canDecrease}
        accessibilityRole="button"
        accessibilityLabel={`${itemLabel} 수량 줄이기`}
        accessibilityState={{ disabled: !canDecrease }}
        className={`h-11 w-11 items-center justify-center ${canDecrease ? '' : 'opacity-40'}`}
      >
        <AppIcon icon={Minus} />
      </Pressable>
      <Text
        className="min-w-8 text-center font-bold"
        accessibilityLabel={`수량 ${value}개`}
        accessibilityLiveRegion="polite"
      >
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        disabled={!canIncrease}
        accessibilityRole="button"
        accessibilityLabel={`${itemLabel} 수량 늘리기`}
        accessibilityState={{ disabled: !canIncrease }}
        className={`h-11 w-11 items-center justify-center ${canIncrease ? '' : 'opacity-40'}`}
      >
        <AppIcon icon={Plus} />
      </Pressable>
    </View>
  );
}
