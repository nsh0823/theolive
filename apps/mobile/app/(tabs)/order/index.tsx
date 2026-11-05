import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Coffee } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ALL_CATEGORIES, CategoryTabs } from '@/components/order/CategoryTabs';
import { CartBar } from '@/components/order/CartBar';
import { MenuItemCard } from '@/components/order/MenuItemCard';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useCategoriesQuery, useMenuQuery } from '@/fixtures/queries';
import { displayItemCount, displaySubtotal, joinCartLines } from '@/lib/displayTotals';
import { combineStates } from '@/lib/queryState';
import type { MenuCategory, MenuItem } from '@/models';
import { useCartStore } from '@/store/useCartStore';

function MenuList({ categories, menu }: { categories: MenuCategory[]; menu: MenuItem[] }) {
  const router = useRouter();
  const lines = useCartStore((state) => state.lines);
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const visible =
    categoryId === ALL_CATEGORIES ? menu : menu.filter((item) => item.categoryId === categoryId);
  const entries = joinCartLines(lines, menu);
  // One heading per category, like a printed menu; empty categories are skipped.
  const sections = categories
    .map((category) => ({
      category,
      items: visible.filter((item) => item.categoryId === category.id),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Screen
      footer={
        entries.length > 0 ? (
          <CartBar count={displayItemCount(entries)} total={displaySubtotal(entries)} />
        ) : undefined
      }
    >
      <CategoryTabs categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
      {visible.length === 0 ? (
        <Text className="py-10 text-center text-muted-foreground">
          이 카테고리에는 아직 메뉴가 없어요.
        </Text>
      ) : null}
      {sections.map(({ category, items }) => (
        <View key={category.id} className="gap-2">
          <Heading size="md" accessibilityRole="header">
            {category.name}
          </Heading>
          {items.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              onPress={() => router.push({ pathname: '/order/item/[id]', params: { id: item.id } })}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

export default function OrderScreen() {
  const state = combineStates(useCategoriesQuery(), useMenuQuery());
  return (
    <QueryBoundary
      state={state}
      isEmpty={([, menu]) => isEmptyList(menu)}
      emptyMessage="지금 주문할 수 있는 메뉴가 없어요."
      emptyIcon={Coffee}
    >
      {([categories, menu]) => <MenuList categories={categories} menu={menu} />}
    </QueryBoundary>
  );
}
