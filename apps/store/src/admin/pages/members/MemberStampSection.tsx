import { Leaf } from 'lucide-react';
import type { MemberLedgerEntryView } from '@theolive/api';
import { stampKindLabel } from '@/domain/labels';
import { StampBanner } from '@/shared/RewardBanners';
import { Card, CardHeader, StatFigure, StatRow } from '@/ui/Card';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { formatCount, formatDate } from '@/lib/format';

/** Olive Stamps only: the server's balance in 개 and the stamp ledger. Never shows point data. */
export function MemberStampSection({
  balance,
  entries,
}: {
  balance: number;
  entries: MemberLedgerEntryView[];
}) {
  return (
    <section aria-label="올리브 스탬프" className="flex flex-col gap-4">
      <StampBanner />
      <Card>
        <CardHeader icon={<Leaf className="size-5" />} title="스탬프 잔액 · 내역" />
        <StatRow>
          <StatFigure value={`${formatCount(balance)}개`} label="보유 스탬프" />
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
                  <Td className="tabular-nums">{formatDate(entry.createdAt)}</Td>
                  <Td>
                    {stampKindLabel(entry.kind)}
                    <span className="text-muted-foreground"> · {entry.label}</span>
                  </Td>
                  <Td className="text-right font-semibold tabular-nums">
                    {entry.delta > 0 ? '+' : ''}
                    {entry.delta}개
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
