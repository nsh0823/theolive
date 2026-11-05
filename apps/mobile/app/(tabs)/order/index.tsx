import { useRouter } from 'expo-router';
import { Coffee } from 'lucide-react-native';
import { useState } from 'react';

import { MenuItemCard } from '@/components/order/MenuItemCard';
import { Chip } from '@/components/ui/Chip';
import { ChipRow } from '@/components/ui/ChipRow';
import { QueryBoundary, isEmptyList } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { combineStates } from '@/lib/queryState';
import { useCategoriesQuery, useMenuQuery } from '@/fixtures/queries';

const ALL_CATEGORIES = 'all';

export default function OrderScreen() {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const state = combineStates(useCategoriesQuery(), useMenuQuery());

  return (
    <Screen>
      <QueryBoundary
        state={state}
        isEmpty={([, menu]) => isEmptyList(menu)}
        emptyMessage="지금 주문할 수 있는 메뉴가 없어요."
        emptyIcon={Coffee}
      >
        {([categories, menu]) => {
          const visible =
            categoryId === ALL_CATEGORIES
              ? menu
              : menu.filter((item) => item.categoryId === categoryId);
          return (
            <>
              <ChipRow>
                <Chip
                  label="전체"
                  selected={categoryId === ALL_CATEGORIES}
                  onPress={() => setCategoryId(ALL_CATEGORIES)}
                />
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={categoryId === category.id}
                    onPress={() => setCategoryId(category.id)}
                  />
                ))}
              </ChipRow>
              {visible.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onPress={() =>
                    router.push({ pathname: '/order/item/[id]', params: { id: item.id } })
                  }
                />
              ))}
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}
