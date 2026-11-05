import { Text } from '@theolive/ui/components/text';
import { Check, Circle } from 'lucide-react-native';
import { View } from 'react-native';

import { ORDER_STATUS_LABEL } from '@/lib/labels';
import { ORDER_STATUS, type OrderStatus } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';

const PROGRESS: OrderStatus[] = [
  ORDER_STATUS.PAID,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.COMPLETED,
];

const TERMINAL_MESSAGE: Partial<Record<OrderStatus, string>> = {
  [ORDER_STATUS.REJECTED]: '매장 사정으로 주문이 거절되었어요. 결제는 환불 처리됩니다.',
  [ORDER_STATUS.CANCELLED]: '주문이 취소되었어요.',
};

/** Step list; state is conveyed by icon and text, never color alone (PRD 10.4). */
export function OrderStatusTracker({ status }: { status: OrderStatus }) {
  const terminalMessage = TERMINAL_MESSAGE[status];
  if (terminalMessage) {
    return (
      <Card className="gap-2" accessibilityRole="alert">
        <Pill label={ORDER_STATUS_LABEL[status]} tone="danger" />
        <Text>{terminalMessage}</Text>
      </Card>
    );
  }
  const currentIndex = PROGRESS.indexOf(status);
  return (
    <Card className="gap-3">
      {PROGRESS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const state = isDone ? '완료' : isCurrent ? '진행 중' : '대기';
        return (
          <View
            key={step}
            className="min-h-8 flex-row items-center gap-3"
            accessible
            accessibilityLabel={`${ORDER_STATUS_LABEL[step]}, ${state}`}
          >
            <AppIcon
              icon={isDone ? Check : Circle}
              tone={isDone || isCurrent ? 'primary' : 'muted'}
            />
            <Text className={isCurrent ? 'flex-1 font-bold' : 'flex-1 text-muted-foreground'}>
              {ORDER_STATUS_LABEL[step]}
            </Text>
            {isCurrent ? <Pill label="현재" tone="primary" /> : null}
          </View>
        );
      })}
    </Card>
  );
}
