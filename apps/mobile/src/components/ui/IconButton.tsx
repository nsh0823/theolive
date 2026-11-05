import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { AppIcon } from './AppIcon';

type Props = { icon: LucideIcon; label: string; onPress: () => void };

/** 44x44pt icon-only control; the label is mandatory for screen readers. */
export function IconButton({ icon, label, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-secondary"
    >
      <AppIcon icon={icon} tone="primary" />
    </Pressable>
  );
}
