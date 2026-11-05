import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { useState } from 'react';

import { CtaButton } from '@/components/ui/CtaButton';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { Pill } from '@/components/ui/Pill';
import { useMenuItemQuery } from '@/fixtures/queries';
import { useRouteParam } from '@/hooks/useRouteParam';
import { formatWon } from '@/lib/format';
import { TEMPERATURE_LABEL } from '@/lib/labels';
import type { MenuItem, Temperature } from '@/models';
import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY, useCartStore } from '@/store/useCartStore';

function ItemDetail({ item }: { item: MenuItem }) {
  const router = useRouter();
  const addLine = useCartStore((state) => state.addLine);
  const [temperature, setTemperature] = useState<Temperature>(item.temperatures[0] ?? 'HOT');
  const [quantity, setQuantity] = useState(MIN_LINE_QUANTITY);

  const addToCart = () => {
    addLine(item.id, temperature, quantity);
    Alert.alert('장바구니에 담았어요', undefined, [
      { text: '계속 주문하기', style: 'cancel', onPress: () => router.back() },
      { text: '장바구니로 이동', onPress: () => router.replace('/order/cart') },
    ]);
  };

  const orderNow = () => {
    addLine(item.id, temperature, quantity);
    router.push('/order/order-type');
  };

  return (
    <Screen
      footer={
        <>
          <View className="flex-row items-center justify-between">
            <QuantityStepper
              value={quantity}
              min={MIN_LINE_QUANTITY}
              max={MAX_LINE_QUANTITY}
              onChange={setQuantity}
              itemLabel={item.name}
            />
            <Text size="xl" className="font-bold">
              {formatWon(item.price * quantity)}
            </Text>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <CtaButton
                label="담기"
                variant="outline"
                onPress={addToCart}
                isDisabled={item.isSoldOut}
              />
            </View>
            <View className="flex-1">
              <CtaButton label="주문하기" onPress={orderNow} isDisabled={item.isSoldOut} />
            </View>
          </View>
        </>
      }
    >
      <Thumbnail size="lg" />
      <View className="gap-2">
        <Heading size="xl">{item.name}</Heading>
        <Text className="text-muted-foreground">{item.description}</Text>
        <Text size="2xl" className="font-bold">
          {formatWon(item.price)}
        </Text>
        {item.isSoldOut ? <Pill label="품절된 메뉴예요" tone="danger" /> : null}
      </View>
      <View className="gap-2">
        <Heading size="xs" accessibilityRole="header">
          온도
        </Heading>
        <Segmented
          groupLabel="온도 선택"
          value={temperature}
          onChange={setTemperature}
          options={item.temperatures.map((value) => ({ value, label: TEMPERATURE_LABEL[value] }))}
        />
      </View>
    </Screen>
  );
}

export default function ItemDetailScreen() {
  const id = useRouteParam('id') ?? '';
  const state = useMenuItemQuery(id);
  return (
    <QueryBoundary
      state={state}
      isEmpty={(item) => item === null}
      emptyMessage="메뉴를 찾을 수 없어요."
    >
      {(item) => (item ? <ItemDetail key={item.id} item={item} /> : null)}
    </QueryBoundary>
  );
}
