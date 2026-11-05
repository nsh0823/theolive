import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import { formatSignedWon, formatWon } from '@/lib/format';

import { Card } from '../ui/Card';

type Props = {
  menuAmount: number;
  couponDiscount: number;
  pointsUsed: number;
  finalAmount: number;
};

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View
      className="flex-row items-center justify-between"
      accessible
      accessibilityLabel={`${label} ${value}`}
    >
      <Text className={strong ? 'font-bold' : 'text-muted-foreground'}>{label}</Text>
      <Text className={strong ? 'text-lg font-bold' : 'font-semibold'}>{value}</Text>
    </View>
  );
}

/**
 * PRD 5.4 PAY-01: menu amount, discount, points, and final amount shown separately.
 * Values are passed in; this component does no arithmetic.
 */
export function AmountSummary({ menuAmount, couponDiscount, pointsUsed, finalAmount }: Props) {
  return (
    <Card className="gap-3">
      <Row label="메뉴 금액" value={formatWon(menuAmount)} />
      <Row label="쿠폰 할인" value={formatSignedWon(-couponDiscount)} />
      <Row label="쿠폰 포인트 사용" value={formatSignedWon(-pointsUsed)} />
      <View className="h-px bg-border" />
      <Row label="최종 결제 금액" value={formatWon(finalAmount)} strong />
    </Card>
  );
}
