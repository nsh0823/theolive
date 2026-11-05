import { Text } from '@theolive/ui/components/text';
import { Pressable, View } from 'react-native';

import { PAYMENT_METHOD_LABEL, TEST_PAYMENT_LABEL } from '@/lib/labels';
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
 * Which methods are offered, and whether each works, is decided by the PG contract. Until then every
 * method goes through the TEST payment sheet (OQ-21) and is labelled as such.
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
              <Text size="xs" className="font-semibold text-muted-foreground">
                {TEST_PAYMENT_LABEL}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text size="xs" className="text-muted-foreground">
        테스트 결제예요. 실제로 돈이 빠져나가지 않아요. 실제 결제수단은 PG 계약 확정 후 정해져요.
      </Text>
    </FormSection>
  );
}
