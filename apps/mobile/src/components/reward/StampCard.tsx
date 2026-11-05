import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { Leaf } from 'lucide-react-native';
import { View } from 'react-native';

import { stampProgress } from '@/lib/stamps';
import type { StampSummary } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { ProgressBar } from '../ui/ProgressBar';

type Props = { stamps: StampSummary; variant?: 'full' | 'compact' };

const SLOTS_PER_ROW = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size)
    rows.push(items.slice(start, start + size));
  return rows;
}

function StampSlots({ slots }: { slots: boolean[] }) {
  return (
    <View
      className="w-full gap-2"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {chunk(slots, SLOTS_PER_ROW).map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row justify-between">
          {row.map((filled, index) => (
            <View
              key={index}
              className={`h-12 w-12 items-center justify-center rounded-full ${
                filled ? 'bg-primary-foreground' : 'border border-dashed border-sage'
              }`}
            >
              {filled ? <AppIcon icon={Leaf} tone="primary" size={22} /> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Olive Stamps: a solid Deep Olive card, deliberately unlike the cream Coupon Points card
 * so the two assets are never confused (PRD 5.5). Full = a hero count in a dashed ring
 * (like a rewards dial) over the slot grid; compact = a single row with a progress bar.
 */
export function StampCard({ stamps, variant = 'full' }: Props) {
  const { remaining, fraction, isComplete } = stampProgress(stamps);
  const slots = Array.from({ length: stamps.goal }, (_, index) => index < stamps.count);
  const progressText = isComplete
    ? '쿠폰으로 교환할 수 있어요'
    : `다음 보상까지 ${remaining}개 남았어요`;
  const label = `올리브 스탬프 ${stamps.count}개, 목표 ${stamps.goal}개, ${progressText}`;

  if (variant === 'compact') {
    return (
      <View className="gap-4 rounded-2xl bg-primary p-5" accessible accessibilityLabel={label}>
        <View className="flex-row items-end justify-between">
          <View className="gap-1">
            <Heading size="sm" className="text-primary-foreground">
              올리브 스탬프
            </Heading>
            <Text size="sm" className="text-primary-foreground">
              {progressText}
            </Text>
          </View>
          <Text size="3xl" className="font-bold text-primary-foreground">
            {stamps.count}
            <Text size="md" className="text-primary-foreground">
              {' '}
              / {stamps.goal}
            </Text>
          </Text>
        </View>
        <ProgressBar
          fraction={fraction}
          onDark
          label={`스탬프 진행률 ${stamps.count}/${stamps.goal}`}
        />
      </View>
    );
  }

  return (
    <View
      className="items-center gap-5 rounded-3xl bg-primary px-5 py-6"
      accessible
      accessibilityLabel={label}
    >
      <Heading size="md" className="self-start text-primary-foreground">
        올리브 스탬프 {stamps.count}개를 모았어요
      </Heading>
      <View className="h-48 w-48 items-center justify-center rounded-full border-2 border-dashed border-sage">
        <View className="h-36 w-36 items-center justify-center rounded-full bg-primary-foreground">
          <Text size="5xl" className="font-bold text-primary">
            {stamps.count}
          </Text>
          <Text size="sm" className="text-primary">
            / {stamps.goal}
          </Text>
        </View>
      </View>
      <Text className="text-center font-semibold text-primary-foreground">{progressText}</Text>
      <StampSlots slots={slots} />
    </View>
  );
}
