import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { PointSummary, StampSummary } from '@/models';

import { PointBalanceCard } from '../reward/PointBalanceCard';
import { StampCard } from '../reward/StampCard';
import { CtaButton } from '../ui/CtaButton';
import { SectionHeader } from '../ui/SectionHeader';

type Props = { stamps: StampSummary; points: PointSummary };

/** HOME-04: stamps and points are two separate cards with one CTA to the Reward tab. */
export function RewardSummary({ stamps, points }: Props) {
  const router = useRouter();
  return (
    <View className="gap-4">
      <SectionHeader title="내 리워드" />
      <Pressable
        onPress={() => router.push('/reward/stamps')}
        accessibilityRole="button"
        accessibilityHint="올리브 스탬프 화면으로 이동"
      >
        <StampCard stamps={stamps} variant="compact" />
      </Pressable>
      <Pressable
        onPress={() => router.push('/reward/points')}
        accessibilityRole="button"
        accessibilityHint="쿠폰 포인트 화면으로 이동"
      >
        <PointBalanceCard points={points} />
      </Pressable>
      <CtaButton
        label="리워드 전체 보기"
        variant="outline"
        onPress={() => router.push('/reward')}
      />
      <Text size="xs" className="text-center text-muted-foreground">
        올리브 스탬프와 쿠폰 포인트는 따로 관리돼요.
      </Text>
    </View>
  );
}
