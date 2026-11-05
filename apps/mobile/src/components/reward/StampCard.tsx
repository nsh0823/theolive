import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import type { StampSummary } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { Card } from '../ui/Card';

/** Olive Stamps: its own asset, never combined with Coupon Points (PRD 5.5). */
export function StampCard({ stamps }: { stamps: StampSummary }) {
  const slots = Array.from({ length: stamps.goal }, (_, index) => index < stamps.count);
  return (
    <Card
      className="gap-4"
      accessible
      accessibilityLabel={`올리브 스탬프 ${stamps.count}개, 목표 ${stamps.goal}개`}
    >
      <View className="flex-row items-baseline justify-between">
        <Heading size="sm">올리브 스탬프</Heading>
        <Text className="font-bold text-primary">
          {stamps.count} / {stamps.goal}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2" accessibilityElementsHidden>
        {slots.map((filled, index) => (
          <View
            key={index}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              filled ? 'bg-primary' : 'border border-dashed border-sage bg-card'
            }`}
          >
            {filled ? <AppIcon icon={Check} tone="primaryForeground" size={18} /> : null}
          </View>
        ))}
      </View>
    </Card>
  );
}
