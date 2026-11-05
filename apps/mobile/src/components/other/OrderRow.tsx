import { Text } from '@theolive/ui/components/text';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { formatWon } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/labels';
import type { Order } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';

type Props = { order: Order; onPress: (order: Order) => void };

/** OTH-01: date, order number, amount, status. */
export function OrderRow({ order, onPress }: Props) {
  const summary = order.lines[0]?.name ?? '';
  const extra = order.lines.length > 1 ? ` 외 ${order.lines.length - 1}건` : '';
  return (
    <Pressable
      onPress={() => onPress(order)}
      accessibilityRole="button"
      accessibilityLabel={`${order.placedAt}, 주문번호 ${order.orderNumber}, ${summary}${extra}, ${formatWon(order.paidAmount)}, ${ORDER_STATUS_LABEL[order.status]}`}
    >
      <Card className="flex-row items-center gap-3">
        <View className="flex-1 gap-1">
          <Text size="xs" className="text-muted-foreground">
            {order.placedAt} · {order.orderNumber}
          </Text>
          <Text className="font-semibold">
            {summary}
            {extra}
          </Text>
          <Text className="font-bold">{formatWon(order.paidAmount)}</Text>
        </View>
        <Pill label={ORDER_STATUS_LABEL[order.status]} />
        <AppIcon icon={ChevronRight} tone="muted" />
      </Card>
    </Pressable>
  );
}
