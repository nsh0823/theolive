import { Text } from '@theolive/ui/components/text';
import { Store } from 'lucide-react-native';
import { View } from 'react-native';

import { useOrderAvailability } from '@/hooks/useStoreStatus';

import { AppIcon } from '../ui/AppIcon';

/** Shown on the order screens while the store is closed or not accepting orders (the server also refuses). */
export function StoreClosedBanner() {
  const { message } = useOrderAvailability();
  if (message === null) return null;
  return (
    <View
      className="flex-row items-center gap-3 rounded-xl bg-cream p-4"
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <AppIcon icon={Store} tone="muted" />
      <Text size="sm" className="flex-1 font-semibold">
        {message}
      </Text>
    </View>
  );
}
