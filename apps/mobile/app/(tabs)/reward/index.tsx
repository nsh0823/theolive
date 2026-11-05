import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { View } from 'react-native';

import { CouponCard } from '@/components/reward/CouponCard';
import { PointBalanceCard } from '@/components/reward/PointBalanceCard';
import { StampCard } from '@/components/reward/StampCard';
import { CtaButton } from '@/components/ui/CtaButton';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useCouponsQuery, usePointsQuery, useStampsQuery } from '@/fixtures/queries';
import { COUPON_STATUS } from '@/models';

const COUPON_PREVIEW_LIMIT = 2;

/** My Rewards: Olive Stamps, coupons, and Coupon Points as three separate sections (PRD 5.5). */
export default function RewardScreen() {
  const router = useRouter();
  const stamps = useStampsQuery();
  const coupons = useCouponsQuery();
  const points = usePointsQuery();

  return (
    <Screen>
      <View className="gap-4">
        <Heading size="md" accessibilityRole="header">
          올리브 스탬프
        </Heading>
        <QueryBoundary state={stamps} emptyMessage="">
          {(data) => <StampCard stamps={data} />}
        </QueryBoundary>
        <CtaButton
          label="스탬프 내역 · 쿠폰 교환"
          variant="secondary"
          onPress={() => router.push('/reward/stamps')}
        />
      </View>

      <View className="gap-4">
        <SectionHeader title="내 쿠폰" actionLabel="내 쿠폰함 가기" actionHref="/reward/coupons" />
        <QueryBoundary
          state={coupons}
          isEmpty={(list) => list.every((c) => c.status !== COUPON_STATUS.AVAILABLE)}
          emptyMessage="사용 가능한 쿠폰이 없어요."
          emptyIcon={Ticket}
        >
          {(list) =>
            list
              .filter((c) => c.status === COUPON_STATUS.AVAILABLE)
              .slice(0, COUPON_PREVIEW_LIMIT)
              .map((coupon) => <CouponCard key={coupon.id} coupon={coupon} />)
          }
        </QueryBoundary>
        <Text size="sm" className="text-muted-foreground">
          교환한 쿠폰은 결제할 때 사용할 수 있어요.
        </Text>
      </View>

      <View className="gap-4">
        <Heading size="md" accessibilityRole="header">
          쿠폰 포인트
        </Heading>
        <QueryBoundary state={points} emptyMessage="">
          {(data) => <PointBalanceCard points={data} />}
        </QueryBoundary>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <CtaButton label="포인트 등록" onPress={() => router.push('/reward/point-code')} />
          </View>
          <View className="flex-1">
            <CtaButton
              label="사용 내역"
              variant="secondary"
              onPress={() => router.push('/reward/points')}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}
