import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import { formatSignedWon, formatWon } from '@/lib/format';

type Props = {
  menuAmount: number;
  couponDiscount: number;
  pointsUsed: number;
  finalAmount: number;
};

function Row({
  label,
  value,
  strong = false,
  big = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
}) {
  return (
    <View
      className="flex-row items-center justify-between"
      accessible
      accessibilityLabel={`${label} ${value}`}
    >
      <Text className={strong ? 'font-bold' : 'text-muted-foreground'}>{label}</Text>
      <Text size={big ? '2xl' : 'md'} className={strong ? 'font-bold' : 'font-semibold'}>
        {value}
      </Text>
    </View>
  );
}

/**
 * PRD 5.4 PAY-01: product amount, discount, points, and final amount shown separately,
 * on a full-bleed Warm Cream panel. Values are passed in; this component does no arithmetic.
 */
export function AmountSummary({ menuAmount, couponDiscount, pointsUsed, finalAmount }: Props) {
  return (
    <View className="-mx-5 gap-3 bg-cream px-5 py-6">
      <Row label="상품 금액" value={formatWon(menuAmount)} />
      <Row label="쿠폰 할인" value={formatSignedWon(-couponDiscount)} />
      <Row label="포인트 사용" value={formatSignedWon(-pointsUsed)} />
      <View className="my-1 h-px bg-border" />
      <Row label="최종 결제 금액" value={formatWon(finalAmount)} strong big />
    </View>
  );
}
