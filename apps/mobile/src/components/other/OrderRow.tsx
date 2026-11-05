import { Text } from '@theolive/ui/components/text';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { formatDateTime, formatWon } from '@/lib/format';
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL } from '@/lib/labels';
import type { Order } from '@/models';

import { AppIcon } from '../ui/AppIcon';
import { CtaButton } from '../ui/CtaButton';
import { Pill } from '../ui/Pill';

type Props = { order: Order; onPress: (order: Order) => void; onReorder: (order: Order) => void };

/** OTH-01: date/time, order number, products, type, amount, status, and reorder. */
export function OrderRow({ order, onPress, onReorder }: Props) {
  const products = order.lines.map((line) => `${line.name} ${line.quantity}개`).join(', ');
  const placedAt = formatDateTime(order.placedAt);
  const number = order.orderNumber ?? '-';
  return (
    <View className="gap-3 border-b border-border py-5">
      <Pressable
        onPress={() => onPress(order)}
        accessibilityRole="button"
        accessibilityLabel={`${placedAt}, 주문번호 ${number}, ${products}, ${ORDER_TYPE_LABEL[order.orderType]}, ${formatWon(order.paidAmount)}, ${ORDER_STATUS_LABEL[order.status]}`}
        className="gap-2"
      >
        <View className="flex-row items-center justify-between gap-2">
          <Text size="xs" className="flex-1 text-muted-foreground">
            {placedAt} · {number}
          </Text>
          <Pill label={ORDER_STATUS_LABEL[order.status]} />
          <AppIcon icon={ChevronRight} tone="muted" />
        </View>
        <Text className="font-semibold" numberOfLines={2}>
          {products}
        </Text>
        <View className="flex-row items-center justify-between">
          <Text size="sm" className="text-muted-foreground">
            {ORDER_TYPE_LABEL[order.orderType]}
          </Text>
          <Text className="font-bold">{formatWon(order.paidAmount)}</Text>
        </View>
      </Pressable>
      <CtaButton label="다시 주문" variant="secondary" onPress={() => onReorder(order)} />
    </View>
  );
}
