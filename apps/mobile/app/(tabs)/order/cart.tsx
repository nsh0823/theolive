import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import { StoreClosedBanner } from '@/components/order/StoreClosedBanner';
import { CartLineRow } from '@/components/order/CartLineRow';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { EmptyView } from '@/components/ui/StateViews';
import { useMenuQuery } from '@/hooks/useMenu';
import { useOrderAvailability } from '@/hooks/useStoreStatus';
import { pruneCart, removeSoldOut } from '@/lib/cartPruning';
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
  const { lines, removedCount, setQuantity, removeLine, changeTemperature, replaceLines } =
    useCartStore();
  const dropUnavailable = useCartStore((state) => state.dropUnavailable);
  const { canOrder } = useOrderAvailability();
  const entries = joinCartLines(lines, menu);

  // Lines whose item was hidden or archived since they were added cannot be ordered: drop them from the cart
  // itself (not just the display) and tell the customer.
  useEffect(() => {
    const { kept, removed } = pruneCart(lines, menu);
    if (removed.length === 0) return;
    dropUnavailable(kept, removed.length);
  }, [lines, menu, dropUnavailable]);

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

  const hasSoldOut = hasSoldOutLine(entries);
  const blocked = hasSoldOut || !canOrder;
  return (
    <Screen
      footer={
        <>
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-muted-foreground">
              총 {displayItemCount(entries)}개
            </Text>
            <Text size="3xl" className="font-bold">
              {formatWon(displaySubtotal(entries))}
            </Text>
          </View>
          <CtaButton
            label="주문하기"
            onPress={() => router.push('/order/order-type')}
            isDisabled={blocked}
            accessibilityHint={hasSoldOut ? '품절된 메뉴를 삭제해야 주문할 수 있어요' : undefined}
          />
        </>
      }
    >
      <StoreClosedBanner />
      {removedCount > 0 ? (
        <Text size="sm" className="rounded-xl bg-cream p-4 font-semibold" accessibilityRole="alert">
          판매가 종료된 메뉴 {removedCount}개를 장바구니에서 뺐어요.
        </Text>
      ) : null}
      {hasSoldOut ? (
        <CtaButton
          label="품절된 메뉴 모두 삭제"
          variant="outline"
          onPress={() => replaceLines(removeSoldOut(lines, menu))}
        />
      ) : null}
      <Heading size="md" accessibilityRole="header">
        주문 메뉴
      </Heading>
      {entries.map((entry) => (
        <CartLineRow
          key={`${entry.line.menuItemId}-${entry.line.temperature}`}
          entry={entry}
          onQuantityChange={(quantity) =>
            setQuantity(entry.line.menuItemId, entry.line.temperature, quantity)
          }
          onRemove={() => removeLine(entry.line.menuItemId, entry.line.temperature)}
          onChangeTemperature={(next) =>
            changeTemperature(entry.line.menuItemId, entry.line.temperature, next)
          }
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
