import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from '../ui/IconButton';
import { CartButton } from './CartButton';

/** Order header: search and cart in the upper right (brief 6.1). */
export function HeaderActions() {
  const router = useRouter();
  return (
    <View className="flex-row items-center">
      <IconButton icon={Search} label="메뉴 검색" onPress={() => router.push('/order/search')} />
      <CartButton />
    </View>
  );
}
