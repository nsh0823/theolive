import { Text } from '@theolive/ui/components/text';
import { CircleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { AppIcon } from '../ui/AppIcon';
import { CtaButton } from '../ui/CtaButton';
import { LoadingView } from '../ui/StateViews';

export type PaymentPhase = 'idle' | 'processing' | 'failed';

type Props = {
  phase: Exclude<PaymentPhase, 'idle'>;
  onRetry: () => void;
  /** Why it failed; defaults to the generic text. */
  message?: string;
};

/** PRD 8.4: payment progress and failure are explicit states. */
export function PaymentStatusView({ phase, onRetry, message }: Props) {
  if (phase === 'processing') {
    return <LoadingView label="결제를 진행하고 있어요. 잠시만 기다려 주세요." />;
  }
  return (
    <View className="items-center gap-4 py-12" accessibilityRole="alert">
      <AppIcon icon={CircleAlert} tone="destructive" size={40} />
      <Text className="text-center">
        {message ?? '결제에 실패했어요. 주문은 접수되지 않았고 쿠폰과 포인트도 차감되지 않았어요.'}
      </Text>
      <CtaButton label="다시 결제하기" onPress={onRetry} variant="outline" />
    </View>
  );
}
