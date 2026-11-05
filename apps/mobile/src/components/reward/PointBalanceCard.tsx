import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { Coins } from 'lucide-react-native';
import { View } from 'react-native';

import { formatCouponExpiry, formatWon } from '@/lib/format';
import type { PointSummary } from '@/models';

import { AppIcon } from '../ui/AppIcon';

/**
 * Coupon Points: a Warm Cream wallet-style card with a coin glyph, visually distinct from the
 * olive Stamp card. Points are denominated in won and act as checkout credit.
 */
export function PointBalanceCard({ points }: { points: PointSummary }) {
  return (
    <View
      className="flex-row items-center gap-4 rounded-xl border border-sage bg-cream p-5"
      accessible
      accessibilityLabel={`쿠폰 포인트 잔액 ${formatWon(points.balance)}${points.held > 0 ? `, 결제 진행 중 ${formatWon(points.held)}` : ''}`}
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <AppIcon icon={Coins} tone="primary" size={24} />
      </View>
      <View className="flex-1 gap-0.5">
        <Heading size="sm">쿠폰 포인트</Heading>
        <Text size="xs" className="text-muted-foreground">
          {points.held > 0
            ? `결제 진행 중 ${formatWon(points.held)}`
            : '결제 금액에서 바로 차감돼요'}
        </Text>
        {points.nextExpiresAt ? (
          <Text size="xs" className="text-muted-foreground">
            가장 빠른 유효기간 {formatCouponExpiry(points.nextExpiresAt)}
          </Text>
        ) : null}
      </View>
      <Text size="2xl" className="font-bold text-primary">
        {formatWon(points.balance)}
      </Text>
    </View>
  );
}
