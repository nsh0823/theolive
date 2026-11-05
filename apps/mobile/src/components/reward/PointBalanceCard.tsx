import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import { formatWon } from '@/lib/format';
import type { PointSummary } from '@/models';

import { Card } from '../ui/Card';

/** Coupon Points balance, a separate asset from stamps. Points are denominated in won. */
export function PointBalanceCard({ points }: { points: PointSummary }) {
  return (
    <Card
      className="gap-2"
      accessible
      accessibilityLabel={`쿠폰 포인트 잔액 ${formatWon(points.balance)}`}
    >
      <Heading size="sm">쿠폰 포인트</Heading>
      <View className="flex-row items-baseline gap-1">
        <Text size="2xl" className="font-bold">
          {formatWon(points.balance)}
        </Text>
      </View>
      <Text size="sm" className="text-muted-foreground">
        결제 금액에서 직접 차감할 수 있어요.
      </Text>
    </Card>
  );
}
