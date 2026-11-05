import { Text } from '@theolive/ui/components/text';
import { Pressable, ScrollView } from 'react-native';

import type { MenuCategory } from '@/models';

export const ALL_CATEGORIES = 'all';

type Props = { categories: MenuCategory[]; selectedId: string; onSelect: (id: string) => void };

type TabProps = { label: string; selected: boolean; onPress: () => void };

function Tab({ label, selected, onPress }: TabProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={`min-h-12 justify-center border-b-2 px-1 ${
        selected ? 'border-foreground' : 'border-transparent'
      }`}
    >
      <Text className={selected ? 'font-bold' : 'font-medium text-muted-foreground'}>{label}</Text>
    </Pressable>
  );
}

/**
 * Menu category navigation: underline text tabs on a white strip with a leading "전체". The
 * selected tab is bold with an underline, so selection never relies on color alone.
 */
export function CategoryTabs({ categories, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-6 px-5"
      className="-mx-5 grow-0 border-b border-border bg-card"
    >
      <Tab
        label="전체"
        selected={selectedId === ALL_CATEGORIES}
        onPress={() => onSelect(ALL_CATEGORIES)}
      />
      {categories.map((category) => (
        <Tab
          key={category.id}
          label={category.name}
          selected={selectedId === category.id}
          onPress={() => onSelect(category.id)}
        />
      ))}
    </ScrollView>
  );
}
