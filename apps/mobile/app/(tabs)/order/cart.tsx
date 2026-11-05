import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { View } from 'react-native';

import { CartLineRow } from '@/components/order/CartLineRow';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { EmptyView } from '@/components/ui/StateViews';
import { useMenuQuery } from '@/fixtures/queries';
import {
  displayItemCount,
  displaySubtotal,
  hasSoldOutLine,
  joinCartLines,
} from '@/lib/displayTotals';
import { formatWon } from '@/lib/format';
import type { MenuItem } from '@/models';
import { useCartStore } from '@/store/useCartStore';

function CartContent({ menu }: { menu: MenuItem[] }) {
  const router = useRouter();
  const { lines, setQuantity, removeLine } = useCartStore();
  const entries = joinCartLines(lines, menu);

  if (entries.length === 0) {
    return (
      <Screen>
        <EmptyView
          icon={ShoppingBag}
          message="장바구니가 비어 있어요."
          actionLabel="메뉴 보러 가기"
          onAction={() => router.replace('/order')}
        />
      </Screen>
    );
  }

  const blocked = hasSoldOutLine(entries);
  return (
    <Screen
      footer={
        <>
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground">총 {displayItemCount(entries)}개</Text>
            <Text size="xl" className="font-bold">
              {formatWon(displaySubtotal(entries))}
            </Text>
          </View>
          <CtaButton
            label="주문하기"
            onPress={() => router.push('/order/order-type')}
            isDisabled={blocked}
            accessibilityHint={blocked ? '품절된 메뉴를 삭제해야 주문할 수 있어요' : undefined}
          />
        </>
      }
    >
      {entries.map((entry) => (
        <CartLineRow
          key={`${entry.line.menuItemId}-${entry.line.temperature}`}
          entry={entry}
          onQuantityChange={(quantity) =>
            setQuantity(entry.line.menuItemId, entry.line.temperature, quantity)
          }
          onRemove={() => removeLine(entry.line.menuItemId, entry.line.temperature)}
        />
      ))}
    </Screen>
  );
}

export default function CartScreen() {
  const menu = useMenuQuery();
  return (
    <QueryBoundary state={menu} emptyMessage="">
      {(items) => <CartContent menu={items} />}
    </QueryBoundary>
  );
}
