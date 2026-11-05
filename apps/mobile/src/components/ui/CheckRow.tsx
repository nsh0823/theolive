import { Text } from '@theolive/ui/components/text';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppIcon } from './AppIcon';

type Props = { label: string; checked: boolean; onToggle: () => void; badge?: string };

/** Checkbox row; checked state is shown by a check glyph, not color alone. */
export function CheckRow({ label, checked, onToggle, badge }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={badge ? `${badge} ${label}` : label}
      accessibilityState={{ checked }}
      className="min-h-11 flex-row items-center gap-3"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-md ${
          checked ? 'bg-primary' : 'border border-sage bg-card'
        }`}
      >
        {checked ? <AppIcon icon={Check} tone="primaryForeground" size={16} /> : null}
      </View>
      <Text className="flex-1">
        {badge ? <Text className="font-semibold text-primary">{badge} </Text> : null}
        {label}
      </Text>
    </Pressable>
  );
}
