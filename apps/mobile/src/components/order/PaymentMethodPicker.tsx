import { Text } from '@theolive/ui/components/text';
import { Pressable, View } from 'react-native';

import { PAYMENT_METHOD_LABEL } from '@/lib/labels';
import { PAYMENT_METHOD, type PaymentMethod } from '@/models';

import { FormSection } from '../ui/FormSection';
import { RadioDot } from '../ui/RadioDot';

const METHODS: PaymentMethod[] = [
  PAYMENT_METHOD.KAKAO_PAY,
  PAYMENT_METHOD.NAVER_PAY,
  PAYMENT_METHOD.TOSS_PAY,
  PAYMENT_METHOD.CARD,
];

type Props = { selected: PaymentMethod | null; onSelect: (method: PaymentMethod) => void };

/**
 * UI only. Which methods are offered, and whether each works, is decided by the PG contract;
 * nothing here starts a payment.
 */
export function PaymentMethodPicker({ selected, onSelect }: Props) {
  return (
    <FormSection title="결제수단">
      <View accessibilityRole="radiogroup">
        {METHODS.map((method) => {
          const isSelected = selected === method;
          return (
            <Pressable
              key={method}
              onPress={() => onSelect(method)}
              accessibilityRole="radio"
              accessibilityLabel={PAYMENT_METHOD_LABEL[method]}
              accessibilityState={{ checked: isSelected }}
              className="min-h-14 flex-row items-center gap-3"
            >
              <RadioDot selected={isSelected} />
              <Text className={`flex-1 ${isSelected ? 'font-bold' : ''}`}>
                {PAYMENT_METHOD_LABEL[method]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text size="xs" className="text-muted-foreground">
        결제 연동 전 화면이에요. 실제 사용 가능한 결제수단은 PG 계약 확정 후 정해져요.
      </Text>
    </FormSection>
  );
}
