import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { PointSummary, StampSummary } from '@/models';

import { PointBalanceCard } from '../reward/PointBalanceCard';
import { StampCard } from '../reward/StampCard';
import { SectionHeader } from '../ui/SectionHeader';

type Props = { stamps: StampSummary; points: PointSummary };

/** HOME-04: stamps and points shown as two separate cards. */
export function RewardSummary({ stamps, points }: Props) {
  const router = useRouter();
  return (
    <View className="gap-3">
      <SectionHeader title="내 리워드" actionLabel="리워드 보기" actionHref="/reward" />
      <Pressable
        onPress={() => router.push('/reward/stamps')}
        accessibilityRole="button"
        accessibilityHint="올리브 스탬프 화면으로 이동"
      >
        <StampCard stamps={stamps} />
      </Pressable>
      <Pressable
        onPress={() => router.push('/reward/points')}
        accessibilityRole="button"
        accessibilityHint="쿠폰 포인트 화면으로 이동"
      >
        <PointBalanceCard points={points} />
      </Pressable>
    </View>
  );
}
