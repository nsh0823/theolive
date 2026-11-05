import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { useRouter } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { View } from 'react-native';

import { PointBalanceCard } from '@/components/reward/PointBalanceCard';
import { StampCard } from '@/components/reward/StampCard';
import { CtaButton } from '@/components/ui/CtaButton';
import { ListGroup } from '@/components/ui/ListGroup';
import { ListRow } from '@/components/ui/ListRow';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { usePointsQuery, useStampsQuery } from '@/fixtures/queries';

/** Olive Stamps and Coupon Points are two separate sections (PRD 5.5, DoD). */
export default function RewardScreen() {
  const router = useRouter();
  const stamps = useStampsQuery();
  const points = usePointsQuery();

  return (
    <Screen>
      <View className="gap-3">
        <Heading size="lg" accessibilityRole="header">
          올리브 스탬프
        </Heading>
        <QueryBoundary state={stamps} emptyMessage="">
          {(data) => <StampCard stamps={data} />}
        </QueryBoundary>
        <CtaButton
          label="스탬프 현황 · 쿠폰 교환"
          variant="secondary"
          onPress={() => router.push('/reward/stamps')}
        />
      </View>

      <View className="gap-3">
        <Heading size="lg" accessibilityRole="header">
          쿠폰 포인트
        </Heading>
        <QueryBoundary state={points} emptyMessage="">
          {(data) => <PointBalanceCard points={data} />}
        </QueryBoundary>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <CtaButton
              label="코드 등록"
              variant="secondary"
              onPress={() => router.push('/reward/point-code')}
            />
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

      <View className="gap-3">
        <Text size="sm" className="text-muted-foreground">
          교환한 쿠폰은 결제 시 사용할 수 있어요.
        </Text>
        <ListGroup>
          <ListRow label="보유 쿠폰" icon={Ticket} onPress={() => router.push('/reward/coupons')} />
        </ListGroup>
      </View>
    </Screen>
  );
}
