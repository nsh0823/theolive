import { Text } from '@theolive/ui/components/text';
import { Ticket } from 'lucide-react-native';
import { View } from 'react-native';

import { formatCouponExpiry } from '@/lib/format';
import { couponBenefitLabel } from '@/lib/labels';
import { COUPON_STATUS, type Coupon, type CouponStatus } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { Pill } from '../ui/Pill';

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  [COUPON_STATUS.AVAILABLE]: '사용 가능',
  [COUPON_STATUS.USED]: '사용 완료',
  [COUPON_STATUS.EXPIRED]: '기간 만료',
};

/** Coupon row card: round ticket glyph, value + title, expiry, and a text status pill. */
export function CouponCard({ coupon }: { coupon: Coupon }) {
  const isAvailable = coupon.status === COUPON_STATUS.AVAILABLE;
  return (
    <View
      className={`flex-row items-center gap-4 rounded-2xl bg-card p-4 ${isAvailable ? '' : 'opacity-60'}`}
      accessible
      accessibilityLabel={`${coupon.title}, ${couponBenefitLabel(coupon)}, ${COUPON_STATUS_LABEL[coupon.status]}, 유효기간 ${formatCouponExpiry(coupon.expiresAt)}`}
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <AppIcon icon={Ticket} tone="primary" size={24} />
      </View>
      <View className="flex-1 gap-1">
        <Text size="lg" className="font-bold text-primary">
          {couponBenefitLabel(coupon)}
        </Text>
        <Text className="font-semibold">{coupon.title}</Text>
        <Text size="sm" className="text-muted-foreground">
          유효기간 {formatCouponExpiry(coupon.expiresAt)}까지
        </Text>
      </View>
      <Pill label={COUPON_STATUS_LABEL[coupon.status]} tone={isAvailable ? 'primary' : 'neutral'} />
    </View>
  );
}
