import { Text } from '@theolive/ui/components/text';
import { Pressable, View } from 'react-native';

type Option<V extends string> = { value: V; label: string };

type Props<V extends string> = {
  options: Option<V>[];
  value: V;
  onChange: (value: V) => void;
  groupLabel: string;
};

/** Pill toggle (DESIGN.md: temperature toggles are fully rounded). */
export function Segmented<V extends string>({ options, value, onChange, groupLabel }: Props<V>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
      className="flex-row rounded-full bg-secondary p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            className={`min-h-11 flex-1 items-center justify-center rounded-full ${
              selected ? 'bg-card' : ''
            }`}
          >
            <Text
              className={selected ? 'font-bold text-primary' : 'font-medium text-muted-foreground'}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
