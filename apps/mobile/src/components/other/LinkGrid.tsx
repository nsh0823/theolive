import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppIcon } from '../ui/AppIcon';

export type LinkItem = {
  label: string;
  icon: LucideIcon;
  /** Omit for a read-only entry such as the app version. */
  onPress?: () => void;
  value?: string;
};

const COLUMNS = 2;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size)
    rows.push(items.slice(start, start + size));
  return rows;
}

function LinkCell({ item }: { item: LinkItem }) {
  const content = (
    <>
      <AppIcon icon={item.icon} tone="muted" />
      <Text className="flex-1" numberOfLines={2}>
        {item.label}
      </Text>
      {item.value ? (
        <Text size="sm" className="text-muted-foreground">
          {item.value}
        </Text>
      ) : null}
    </>
  );
  if (!item.onPress) {
    return (
      <View
        className="min-h-14 flex-1 flex-row items-center gap-3"
        accessible
        accessibilityLabel={item.value ? `${item.label}, ${item.value}` : item.label}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      className="min-h-14 flex-1 flex-row items-center gap-3 active:opacity-60"
    >
      {content}
    </Pressable>
  );
}

type Props = { title: string; items: LinkItem[]; isLast?: boolean };

/** Titled two-column icon + label list, closed by a hairline section divider. */
export function LinkGrid({ title, items, isLast = false }: Props) {
  return (
    <View className={`gap-2 pb-4 ${isLast ? '' : 'border-b border-border'}`}>
      <Heading size="md" accessibilityRole="header">
        {title}
      </Heading>
      {chunk(items, COLUMNS).map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row gap-4">
          {row.map((item) => (
            <LinkCell key={item.label} item={item} />
          ))}
          {row.length < COLUMNS ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}
