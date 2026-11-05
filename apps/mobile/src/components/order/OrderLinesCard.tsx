import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import { formatWon } from '@/lib/format';
import { ORDER_TYPE_LABEL, TEMPERATURE_LABEL } from '@/lib/labels';
import type { OrderLine, OrderType } from '@/models';

import { Card } from '../ui/Card';

type Props = { lines: OrderLine[]; orderType: OrderType };

/** Read-only line items with option and order type (OTH-02, PAY-01). */
export function OrderLinesCard({ lines, orderType }: Props) {
  return (
    <Card className="gap-3">
      <Text size="sm" className="text-muted-foreground">
        {ORDER_TYPE_LABEL[orderType]}
      </Text>
      {lines.map((line, index) => (
        <View
          key={`${line.name}-${line.temperature}-${index}`}
          className="flex-row items-center justify-between"
          accessible
          accessibilityLabel={`${line.name}, ${TEMPERATURE_LABEL[line.temperature]}, ${line.quantity}개, ${formatWon(line.unitPrice * line.quantity)}`}
        >
          <View className="flex-1 gap-0.5">
            <Text className="font-semibold">{line.name}</Text>
            <Text size="sm" className="text-muted-foreground">
              {TEMPERATURE_LABEL[line.temperature]} · {line.quantity}개
            </Text>
          </View>
          <Text className="font-bold">{formatWon(line.unitPrice * line.quantity)}</Text>
        </View>
      ))}
    </Card>
  );
}
