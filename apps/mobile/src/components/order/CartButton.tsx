import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useCartStore } from '@/store/useCartStore';

import { AppIcon } from '../ui/AppIcon';

/** Header cart entry with quantity as text (display count only). */
export function CartButton() {
  const router = useRouter();
  const count = useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));
  return (
    <Pressable
      onPress={() => router.push('/order/cart')}
      accessibilityRole="button"
      accessibilityLabel={`장바구니, ${count}개`}
      className="min-h-11 min-w-11 flex-row items-center justify-center gap-1"
    >
      <AppIcon icon={ShoppingBag} tone="primary" />
      <Text size="sm" className="font-bold text-primary">
        {count}
      </Text>
    </Pressable>
  );
}
