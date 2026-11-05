import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { formatWon } from '@/lib/format';

import { AppIcon } from '../ui/AppIcon';

type Props = { count: number; total: number };

/** Dark sticky cart bar on the menu list; only rendered when the cart has items. */
export function CartBar({ count, total }: Props) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/order/cart')}
      accessibilityRole="button"
      accessibilityLabel={`장바구니 ${count}개, ${formatWon(total)}, 보기`}
      className="-mx-5 -mb-3 -mt-3 min-h-16 flex-row items-center gap-3 bg-foreground px-5 active:opacity-90"
    >
      <Text className="flex-1 font-semibold text-background">
        장바구니 {count}개 · {formatWon(total)}
      </Text>
      <View className="h-11 w-11 items-center justify-center rounded-md border-2 border-background">
        <AppIcon icon={ShoppingBag} tone="background" size={20} />
      </View>
    </Pressable>
  );
}
