import { Text } from '@theolive/ui/components/text';
import { View } from 'react-native';

import { LEDGER_KIND_LABEL } from '@/lib/labels';
import type { LedgerEntry } from '@/models';

type Props = { entries: LedgerEntry[]; unit: 'stamp' | 'won' };

function formatAmount(amount: number, unit: Props['unit']) {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  const magnitude = Math.abs(amount).toLocaleString('ko-KR');
  return unit === 'stamp' ? `${sign}${magnitude}개` : `${sign}${magnitude}원`;
}

/** Flat ledger rows with hairlines; sign and the 적립/사용/취소 label carry meaning, not color. */
export function LedgerList({ entries, unit }: Props) {
  return (
    <View>
      {entries.map((entry) => (
        <View
          key={entry.id}
          className="min-h-16 flex-row items-center justify-between border-b border-border py-3"
          accessible
          accessibilityLabel={`${entry.at} ${LEDGER_KIND_LABEL[entry.kind]} ${entry.label} ${formatAmount(entry.amount, unit)}`}
        >
          <View className="gap-0.5">
            <Text className="font-medium">
              {LEDGER_KIND_LABEL[entry.kind]} · {entry.label}
            </Text>
            <Text size="xs" className="text-muted-foreground">
              {entry.at}
            </Text>
          </View>
          <Text className="font-bold">{formatAmount(entry.amount, unit)}</Text>
        </View>
      ))}
    </View>
  );
}
