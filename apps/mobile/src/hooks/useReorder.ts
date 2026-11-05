import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useMenuQuery } from '@/hooks/useMenu';
import { planReorder } from '@/lib/reorder';
import type { Temperature } from '@/models';
import { useCartStore } from '@/store/useCartStore';

/** Quick reorder: re-adds past lines that are still orderable, then opens the cart. */
export function useReorder() {
  const router = useRouter();
  const menu = useMenuQuery();
  const addLines = useCartStore((state) => state.addLines);

  return (
    lines: {
      menuItemId: string | null;
      name: string;
      temperature: Temperature | null;
      quantity: number;
    }[],
  ) => {
    if (menu.status !== 'success') {
      Alert.alert('메뉴를 불러오지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }
    const { add, skippedNames } = planReorder(lines, menu.data);
    if (add.length === 0) {
      Alert.alert(
        '다시 주문할 수 없어요',
        `${skippedNames.join(', ')}은(는) 지금 주문할 수 없어요.`,
      );
      return;
    }
    addLines(add);
    if (skippedNames.length > 0) {
      Alert.alert(
        '일부 메뉴는 담지 못했어요',
        `${skippedNames.join(', ')}은(는) 지금 주문할 수 없어요.`,
      );
    }
    router.push('/order/cart');
  };
}
