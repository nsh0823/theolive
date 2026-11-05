import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import { CircleAlert, CircleCheck, Clock } from 'lucide-react-native';
import { View } from 'react-native';

import { formatWon } from '@/lib/format';
import { ORDER_TYPE_LABEL, refundNote, rejectReasonText } from '@/lib/labels';
import { ORDER_STATUS, type Order } from '@/models';

import { AppIcon } from '../ui/AppIcon';

function headline(order: Order): { title: string; kind: 'wait' | 'ok' | 'stopped' } {
  if (order.status === ORDER_STATUS.PENDING_PAYMENT) {
    return { title: '결제를 확인하고 있어요', kind: 'wait' };
  }
  if (order.status === ORDER_STATUS.REJECTED)
    return { title: '주문이 거절되었어요', kind: 'stopped' };
  if (order.status === ORDER_STATUS.CANCELLED)
    return { title: '주문이 취소되었어요', kind: 'stopped' };
  return { title: '결제가 완료되었어요', kind: 'ok' };
}

/** Server state of the order at a glance: number, headline, reject reason and refund progress. */
export function OrderResultHeader({ order }: { order: Order }) {
  const { title, kind } = headline(order);
  const reason = rejectReasonText(order.rejectReasonCode, order.rejectReason);
  const refund = refundNote(order.status, order.paymentStatus);
  const icon = kind === 'ok' ? CircleCheck : kind === 'wait' ? Clock : CircleAlert;
  return (
    <View className="items-center gap-2 py-4" accessibilityRole="summary">
      <AppIcon icon={icon} tone={kind === 'stopped' ? 'destructive' : 'primary'} size={56} />
      <Heading size="2xl">{title}</Heading>
      <Text className="text-muted-foreground">
        {ORDER_TYPE_LABEL[order.orderType]} · {formatWon(order.paidAmount)}
      </Text>
      {order.status === ORDER_STATUS.REJECTED && reason ? (
        <Text className="text-center">거절 사유: {reason}</Text>
      ) : null}
      {refund ? <Text className="font-semibold">{refund}</Text> : null}
      {order.orderNumber ? (
        <View className="mt-2 items-center rounded-2xl bg-cream px-8 py-4">
          <Text size="xs" className="text-muted-foreground">
            주문번호
          </Text>
          <Text size="3xl" className="font-bold text-primary">
            {order.orderNumber}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
