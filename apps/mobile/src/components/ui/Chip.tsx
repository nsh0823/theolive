import { Text } from '@theolive/ui/components/text';
import { Pressable } from 'react-native';

type Props = { label: string; selected: boolean; onPress: () => void };

const CHIP_HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

/** Filter pill: 36px visual height, extended to a 44pt touch target via hitSlop. */
export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={`h-9 items-center justify-center rounded-full px-4 ${
        selected ? 'bg-primary' : 'border border-border bg-card'
      }`}
    >
      <Text
        size="sm"
        className={selected ? 'font-semibold text-primary-foreground' : 'font-medium'}
      >
        {label}
      </Text>
    </Pressable>
  );
}
