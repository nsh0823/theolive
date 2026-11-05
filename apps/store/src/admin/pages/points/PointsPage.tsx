import { Coins } from 'lucide-react';
import { usePointCodesQuery } from '@/data/queries';
import { totalPoints } from '@/domain/pointCodes';
import { Card, CardHeader, StatFigure, StatRow } from '@/ui/Card';
import { PointBanner } from '@/shared/RewardBanners';
import { formatWon } from '@/lib/format';
import { PointCodesTable } from './PointCodesTable';
import { PointIssueCard } from './PointIssueCard';
import { PointLookupCard } from './PointLookupCard';

/** Coupon Points only (won, cream identity). Nothing here reads stamp data. */
export function PointsPage() {
  const codes = usePointCodesQuery();
  const totals = totalPoints(codes.data);
  return (
    <div className="flex flex-col gap-5">
      <PointBanner />
      <Card>
        <CardHeader icon={<Coins className="size-5" />} title="포인트 현황" />
        <StatRow>
          <StatFigure value={formatWon(totals.issued)} label="발급된 포인트" />
          <StatFigure value={formatWon(totals.used)} label="사용된 포인트" />
          <StatFigure value={formatWon(totals.remaining)} label="고객 잔여 포인트" />
        </StatRow>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <PointIssueCard existingCount={codes.data.length} />
        <PointLookupCard codes={codes.data} />
      </div>
      <PointCodesTable status={codes.status} codes={codes.data} onRetry={codes.refetch} />
    </div>
  );
}
