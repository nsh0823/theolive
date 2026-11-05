import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import { formatWon } from '@/lib/format';
import { COUPON_STATUS, type Coupon, type CouponStatus } from '@/models';

import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  [COUPON_STATUS.AVAILABLE]: '사용 가능',
  [COUPON_STATUS.USED]: '사용 완료',
  [COUPON_STATUS.EXPIRED]: '기간 만료',
};

export function CouponCard({ coupon }: { coupon: Coupon }) {
  const isAvailable = coupon.status === COUPON_STATUS.AVAILABLE;
  return (
    <Card
      className={`gap-2 ${isAvailable ? '' : 'opacity-60'}`}
      accessible
      accessibilityLabel={`${coupon.title}, ${formatWon(coupon.discountAmount)} 할인, ${COUPON_STATUS_LABEL[coupon.status]}, 유효기간 ${coupon.expiresAt}`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-semibold">{coupon.title}</Text>
        <Pill
          label={COUPON_STATUS_LABEL[coupon.status]}
          tone={isAvailable ? 'primary' : 'neutral'}
        />
      </View>
      <Text size="sm" className="text-muted-foreground">
        유효기간 {coupon.expiresAt}
      </Text>
    </Card>
  );
}
