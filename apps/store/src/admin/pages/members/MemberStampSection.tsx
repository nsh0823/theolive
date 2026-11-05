import { Leaf } from 'lucide-react';
import { stampBalance } from '@/domain/members';
import type { StampLedgerEntry } from '@/domain/memberModels';
import { StampBanner } from '@/shared/RewardBanners';
import { Card, CardHeader, StatFigure, StatRow } from '@/ui/Card';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { formatCount, formatDate } from '@/lib/format';

/** Olive Stamps only: balance in 개 and the stamp ledger. Never shows point data. */
export function MemberStampSection({ entries }: { entries: StampLedgerEntry[] }) {
  return (
    <section aria-label="올리브 스탬프" className="flex flex-col gap-4">
      <StampBanner />
      <Card>
        <CardHeader icon={<Leaf className="size-5" />} title="스탬프 잔액 · 내역" />
        <StatRow>
          <StatFigure value={`${formatCount(stampBalance(entries))}개`} label="보유 스탬프" />
        </StatRow>
        {entries.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">스탬프 내역이 없어요.</p>
        ) : (
          <DataTable caption="스탬프 원장">
            <thead>
              <tr>
                <Th>일자</Th>
                <Th>내용</Th>
                <Th className="text-right">스탬프</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="tabular-nums">{formatDate(entry.at)}</Td>
                  <Td>{entry.label}</Td>
                  <Td className="text-right font-semibold tabular-nums">
                    {entry.amount > 0 ? '+' : ''}
                    {entry.amount}개
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </section>
  );
}
