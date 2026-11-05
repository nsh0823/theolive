import { Input, InputField } from '@theolive/ui/components/input';
import { Text } from '@theolive/ui/components/text';
import { Ticket } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatWon } from '@/lib/format';
import { couponBenefitLabel } from '@/lib/labels';
import type { Coupon } from '@/models';

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

/** PAY-02: only coupons the server says apply to this cart are listed; the discount itself comes from the quote. */
export function CouponPicker({ coupons, selectedId, onSelect }: CouponProps) {
  const options = [
    { id: NO_COUPON, title: '사용 안 함', detail: null },
    ...coupons.map((c) => ({ id: c.id, title: c.title, detail: couponBenefitLabel(c) })),
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

type PointProps = {
  /** Spendable points after open checkouts (server). */
  available: number;
  /** What "use all" would apply to this cart (server). */
  maxUsable: number;
  /** What the server applied to this order (its quote), 0 when none. */
  applied: number;
  /** What the member asked for; differs from `applied` when the server clamped it. */
  requested: number;
  isPricing: boolean;
  onRequest: (points: number) => void;
};

/**
 * PAY-03: spend Coupon Points toward the payment. The member types an amount or taps "use all"; the server quote
 * decides what is applied (balance, total after the coupon and the use rules), and that amount is what gets paid.
 */
export function PointsInput({
  available,
  maxUsable,
  applied,
  requested,
  isPricing,
  onRequest,
}: PointProps) {
  const [draft, setDraft] = useState(requested > 0 ? String(requested) : '');
  const apply = () => {
    const digits = draft.replace(/\D/g, '');
    onRequest(digits === '' ? 0 : Number(digits));
  };
  const clear = () => {
    setDraft('');
    onRequest(0);
  };
  return (
    <FormSection title="쿠폰 포인트">
      <Card className="gap-3 bg-cream">
        <Text className="font-medium">사용 가능 {formatWon(available)}</Text>
        <View className="flex-row items-center gap-2">
          <Input className="min-h-12 flex-1 rounded-md bg-card">
            <InputField
              value={draft}
              onChangeText={setDraft}
              placeholder="사용할 금액"
              keyboardType="number-pad"
              aria-label="사용할 포인트 금액"
              returnKeyType="done"
              onSubmitEditing={apply}
            />
          </Input>
          <Pressable
            onPress={apply}
            accessibilityRole="button"
            accessibilityLabel="포인트 적용"
            className="min-h-12 min-w-16 items-center justify-center rounded-md bg-primary px-4"
          >
            <Text className="font-semibold text-primary-foreground">적용</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => {
              setDraft(String(maxUsable));
              onRequest(maxUsable);
            }}
            accessibilityRole="button"
            accessibilityLabel="포인트 모두 사용"
            disabled={maxUsable <= 0}
            className="min-h-11 justify-center"
          >
            <Text className="font-medium text-primary">모두 사용 ({formatWon(maxUsable)})</Text>
          </Pressable>
          {requested > 0 ? (
            <Pressable
              onPress={clear}
              accessibilityRole="button"
              accessibilityLabel="포인트 사용 안 함"
              className="min-h-11 justify-center"
            >
              <Text className="text-muted-foreground">사용 안 함</Text>
            </Pressable>
          ) : null}
        </View>
        {requested > 0 && !isPricing ? (
          <Text size="sm" accessibilityLiveRegion="polite">
            {applied > 0
              ? `${formatWon(applied)} 사용${applied < requested ? ` (최대 ${formatWon(applied)}까지 사용할 수 있어요)` : ''}`
              : '이 주문에는 포인트를 사용할 수 없어요.'}
          </Text>
        ) : null}
      </Card>
    </FormSection>
  );
}
