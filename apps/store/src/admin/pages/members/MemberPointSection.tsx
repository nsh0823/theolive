import { Coins } from 'lucide-react';
import { pointBalance } from '@/domain/members';
import type { PointLedgerEntry } from '@/domain/memberModels';
import { PointBanner } from '@/shared/RewardBanners';
import { Card, CardHeader, StatFigure, StatRow } from '@/ui/Card';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { formatDate, formatWon } from '@/lib/format';

/** Coupon Points only: balance in 원 and the point ledger. Never shows stamp data. */
export function MemberPointSection({ entries }: { entries: PointLedgerEntry[] }) {
  return (
    <section aria-label="쿠폰 포인트" className="flex flex-col gap-4">
      <PointBanner />
      <Card>
        <CardHeader icon={<Coins className="size-5" />} title="포인트 잔액 · 내역" />
        <StatRow>
          <StatFigure value={formatWon(pointBalance(entries))} label="보유 포인트" />
        </StatRow>
        {entries.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">포인트 내역이 없어요.</p>
        ) : (
          <DataTable caption="포인트 원장">
            <thead>
              <tr>
                <Th>일자</Th>
                <Th>내용</Th>
                <Th className="text-right">포인트</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="tabular-nums">{formatDate(entry.at)}</Td>
                  <Td>{entry.label}</Td>
                  <Td className="text-right font-semibold tabular-nums">
                    {entry.amount > 0 ? '+' : ''}
                    {formatWon(entry.amount)}
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
