import { Text } from '@theolive/ui/components/text';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon } from './AppIcon';

type Props = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  trailingText?: string;
  trailing?: ReactNode;
  destructive?: boolean;
  showChevron?: boolean;
  accessibilityHint?: string;
};

/** Settings-style row, 56pt tall. */
export function ListRow({
  label,
  onPress,
  icon,
  trailingText,
  trailing,
  destructive = false,
  showChevron = true,
  accessibilityHint,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={trailingText ? `${label}, ${trailingText}` : label}
      accessibilityHint={accessibilityHint}
      className="min-h-14 flex-row items-center gap-3 px-4 active:bg-accent"
    >
      {icon ? <AppIcon icon={icon} tone={destructive ? 'destructive' : 'muted'} /> : null}
      <Text className={`flex-1 font-medium ${destructive ? 'text-destructive' : ''}`}>{label}</Text>
      {trailingText ? (
        <Text size="sm" className="text-muted-foreground">
          {trailingText}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <AppIcon icon={ChevronRight} tone="muted" /> : <View />}
    </Pressable>
  );
}

/** Non-interactive row for read-only values (e.g. app version). */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="min-h-14 flex-row items-center justify-between px-4"
      accessible
      accessibilityLabel={`${label}, ${value}`}
    >
      <Text className="font-medium">{label}</Text>
      <Text size="sm" className="text-muted-foreground">
        {value}
      </Text>
    </View>
  );
}
