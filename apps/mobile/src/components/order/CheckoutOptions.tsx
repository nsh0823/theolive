import { Switch } from '@theolive/ui/components/switch';
import { Text } from '@theolive/ui/components/text';
import { Ticket } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { formatWon } from '@/lib/format';
import { COUPON_STATUS, type Coupon } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { Card } from '../ui/Card';
import { FormSection } from '../ui/FormSection';
import { RadioDot } from '../ui/RadioDot';

const NO_COUPON = 'none';

type CouponProps = {
  coupons: Coupon[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/** PAY-02: only available coupons are selectable. */
export function CouponPicker({ coupons, selectedId, onSelect }: CouponProps) {
  const available = coupons.filter((coupon) => coupon.status === COUPON_STATUS.AVAILABLE);
  const options = [
    { id: NO_COUPON, title: '사용 안 함', detail: null },
    ...available.map((c) => ({
      id: c.id,
      title: c.title,
      detail: `${formatWon(c.discountAmount)} 할인`,
    })),
  ];
  return (
    <FormSection title="쿠폰">
      <View accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = (selectedId ?? NO_COUPON) === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id === NO_COUPON ? null : option.id)}
              accessibilityRole="radio"
              accessibilityLabel={
                option.detail ? `${option.title}, ${option.detail}` : option.title
              }
              accessibilityState={{ checked: selected }}
              className="min-h-14 flex-row items-center gap-3"
            >
              <AppIcon icon={Ticket} tone="muted" />
              <View className="flex-1">
                <Text className={selected ? 'font-bold' : ''}>{option.title}</Text>
                {option.detail ? (
                  <Text size="xs" className="text-muted-foreground">
                    {option.detail}
                  </Text>
                ) : null}
              </View>
              <RadioDot selected={selected} />
            </Pressable>
          );
        })}
      </View>
    </FormSection>
  );
}

type PointProps = { balance: number; enabled: boolean; onChange: (enabled: boolean) => void };

/** PAY-03: use Coupon Points toward the payment. */
export function PointToggle({ balance, enabled, onChange }: PointProps) {
  return (
    <FormSection title="쿠폰 포인트">
      <Card className="min-h-14 flex-row items-center justify-between gap-3 bg-cream">
        <View className="flex-1">
          <Text className="font-medium">쿠폰 포인트 모두 사용</Text>
          <Text size="xs" className="text-muted-foreground">
            보유 {formatWon(balance)}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onChange}
          accessibilityLabel="쿠폰 포인트 사용"
          accessibilityState={{ checked: enabled }}
        />
      </Card>
    </FormSection>
  );
}
