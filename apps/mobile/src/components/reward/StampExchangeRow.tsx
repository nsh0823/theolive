import { Text } from '@theolive/ui/components/text';
import { Leaf } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { StampExchangeOption } from '@/models';

import { AppIcon } from '../ui/AppIcon';

type Props = { option: StampExchangeOption; stampCount: number; onExchange: () => void };

/** Exchange row: leaf + required stamps, reward title, and a pill action (44pt tall). */
export function StampExchangeRow({ option, stampCount, onExchange }: Props) {
  const canExchange = stampCount >= option.requiredStamps;
  const status = canExchange ? '교환 가능' : `${option.requiredStamps - stampCount}개 부족`;
  return (
    <View className="min-h-20 flex-row items-center gap-4 rounded-2xl bg-card p-4">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <AppIcon icon={Leaf} tone="primary" size={22} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-bold text-primary">스탬프 {option.requiredStamps}개</Text>
        <Text className="font-semibold">{option.title}</Text>
        <Text size="xs" className="text-muted-foreground">
          {status}
        </Text>
      </View>
      <Pressable
        onPress={onExchange}
        disabled={!canExchange}
        accessibilityRole="button"
        accessibilityLabel={`${option.title} 교환하기`}
        accessibilityHint={canExchange ? undefined : '스탬프가 부족해요'}
        accessibilityState={{ disabled: !canExchange }}
        className={`min-h-11 items-center justify-center rounded-full px-5 ${
          canExchange ? 'bg-primary active:opacity-90' : 'bg-secondary opacity-60'
        }`}
      >
        <Text
          size="sm"
          className={`font-bold ${canExchange ? 'text-primary-foreground' : 'text-secondary-foreground'}`}
        >
          교환
        </Text>
      </Pressable>
    </View>
  );
}
