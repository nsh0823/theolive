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

type StepProps = {
  icon: typeof Plus;
  enabled: boolean;
  label: string;
  onPress: () => void;
};

/** 44pt touch target around a 32pt outlined circle. */
function StepButton({ icon, enabled, label, onPress }: StepProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      className="h-11 w-11 items-center justify-center"
    >
      <View
        className={`h-8 w-8 items-center justify-center rounded-full border ${
          enabled ? 'border-foreground' : 'border-sage opacity-50'
        }`}
      >
        <AppIcon icon={icon} size={18} tone={enabled ? 'foreground' : 'muted'} />
      </View>
    </Pressable>
  );
}

/** Outlined round -/+ buttons with a plain centered count. */
export function QuantityStepper({ value, min, max, onChange, itemLabel }: Props) {
  return (
    <View className="flex-row items-center">
      <StepButton
        icon={Minus}
        enabled={value > min}
        label={`${itemLabel} 수량 줄이기`}
        onPress={() => onChange(value - 1)}
      />
      <Text
        className="min-w-8 text-center text-lg font-bold"
        accessibilityLabel={`수량 ${value}개`}
        accessibilityLiveRegion="polite"
      >
        {value}
      </Text>
      <StepButton
        icon={Plus}
        enabled={value < max}
        label={`${itemLabel} 수량 늘리기`}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}
