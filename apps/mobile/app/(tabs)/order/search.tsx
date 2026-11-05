import { Input, InputField } from '@theolive/ui/components/input';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';

import { MenuItemCard } from '@/components/order/MenuItemCard';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { EmptyView } from '@/components/ui/StateViews';
import { useMenuQuery } from '@/fixtures/queries';
import { searchMenu } from '@/lib/menuSearch';
import type { MenuItem } from '@/models';

function SearchResults({ menu }: { menu: MenuItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const results = searchMenu(menu, query);
  const hasQuery = query.trim().length > 0;

  return (
    <Screen>
      <Input className="min-h-12 rounded-full border-0 bg-card px-3">
        <InputField
          placeholder="메뉴를 검색해 보세요"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          aria-label="메뉴 검색어 입력"
        />
      </Input>
      {!hasQuery ? (
        <EmptyView icon={Search} message="아메리카노, 라떼, 스콘처럼 메뉴 이름으로 찾아보세요." />
      ) : null}
      {hasQuery && results.length === 0 ? (
        <EmptyView icon={Search} message={`'${query.trim()}'에 대한 검색 결과가 없어요.`} />
      ) : null}
      {results.length > 0 ? (
        <Text size="sm" className="text-muted-foreground" accessibilityLiveRegion="polite">
          검색 결과 {results.length}개
        </Text>
      ) : null}
      {results.map((item) => (
        <MenuItemCard
          key={item.id}
          item={item}
          onPress={() => router.push({ pathname: '/order/item/[id]', params: { id: item.id } })}
        />
      ))}
    </Screen>
  );
}

export default function SearchScreen() {
  const state = useMenuQuery();
  return (
    <QueryBoundary state={state} emptyMessage="">
      {(menu) => <SearchResults menu={menu} />}
    </QueryBoundary>
  );
}
