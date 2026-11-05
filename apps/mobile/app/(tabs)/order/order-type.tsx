import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Check, Footprints, Store, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Card } from '@/components/ui/Card';
import { CtaButton } from '@/components/ui/CtaButton';
import { Screen } from '@/components/ui/Screen';
import { ORDER_TYPE_LABEL } from '@/lib/labels';
import { ORDER_TYPE, type OrderType } from '@/models';
import { useCartStore } from '@/store/useCartStore';

const OPTIONS: { value: OrderType; icon: LucideIcon; hint: string }[] = [
  { value: ORDER_TYPE.DINE_IN, icon: Store, hint: '매장에서 먹을게요' },
  { value: ORDER_TYPE.TAKEOUT, icon: Footprints, hint: '밖으로 가져갈게요' },
];

/** ORD-08: dine-in or takeout. No store picker (PRD 1.5). */
export default function OrderTypeScreen() {
  const router = useRouter();
  const { orderType, setOrderType } = useCartStore();

  return (
    <Screen footer={<CtaButton label="다음" onPress={() => router.push('/order/checkout')} />}>
      <View className="gap-1">
        <Heading size="xl" accessibilityRole="header">
          어떻게 받으시겠어요?
        </Heading>
        <Text className="text-muted-foreground">더올리브에서 바로 준비해 드릴게요.</Text>
      </View>
      <View accessibilityRole="radiogroup" className="flex-row gap-3">
        {OPTIONS.map(({ value, icon, hint }) => {
          const selected = value === orderType;
          return (
            <Pressable
              key={value}
              onPress={() => setOrderType(value)}
              accessibilityRole="radio"
              accessibilityLabel={`${ORDER_TYPE_LABEL[value]}, ${hint}`}
              accessibilityState={{ checked: selected }}
              className="flex-1"
            >
              <Card
                className={`min-h-36 items-center justify-center gap-2 rounded-xl ${
                  selected ? 'border-2 border-primary' : ''
                }`}
              >
                {selected ? (
                  <View className="absolute right-3 top-3 h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <AppIcon icon={Check} tone="primaryForeground" size={16} />
                  </View>
                ) : null}
                <AppIcon icon={icon} tone="primary" size={32} />
                <Text className="font-bold">{ORDER_TYPE_LABEL[value]}</Text>
                <Text size="xs" className="text-center text-muted-foreground">
                  {selected ? `선택됨 · ${hint}` : hint}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
