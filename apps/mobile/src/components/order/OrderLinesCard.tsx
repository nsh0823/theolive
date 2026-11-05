import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import { formatWon } from '@/lib/format';
import { ORDER_TYPE_LABEL, lineSummary } from '@/lib/labels';
import type { OrderLine, OrderType } from '@/models';

type Props = { lines: OrderLine[]; orderType: OrderType };

/** Read-only line items with option and order type (OTH-02, PAY-01), as flat rows. */
export function OrderLinesCard({ lines, orderType }: Props) {
  return (
    <View className="gap-4">
      <Text size="sm" className="text-muted-foreground">
        {ORDER_TYPE_LABEL[orderType]}
      </Text>
      {lines.map((line, index) => (
        <View
          key={`${line.name}-${line.temperature}-${index}`}
          className="flex-row items-center justify-between gap-3"
          accessible
          accessibilityLabel={`${line.name}, ${lineSummary(line.temperature, line.quantity)}, ${formatWon(line.unitPrice * line.quantity)}`}
        >
          <View className="flex-1 gap-0.5">
            <Text className="font-semibold">{line.name}</Text>
            <Text size="sm" className="text-muted-foreground">
              {lineSummary(line.temperature, line.quantity)}
            </Text>
          </View>
          <Text className="font-bold">{formatWon(line.unitPrice * line.quantity)}</Text>
        </View>
      ))}
    </View>
  );
}
