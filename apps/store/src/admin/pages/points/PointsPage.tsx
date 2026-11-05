import { usePointCodes, POINT_CODE_PAGE_SIZE, type PointCodeFilters } from '@theolive/api';
import { Coins } from 'lucide-react';
import { useState } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { Card, CardHeader, StatFigure, StatRow } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { PointBanner } from '@/shared/RewardBanners';
import { formatWon } from '@/lib/format';
import { PointCodesTable } from './PointCodesTable';
import { PointIssueCard } from './PointIssueCard';
import { PointLookupCard } from './PointLookupCard';
import { PointPolicyCard } from './PointPolicyCard';

const FIRST_PAGE: PointCodeFilters = {
  status: null,
  search: '',
  limit: POINT_CODE_PAGE_SIZE,
  offset: 0,
};

/** Coupon Points only (won, cream identity). Nothing here reads stamp data. */
export function PointsPage() {
  const client = useSupabase();
  const [filters, setFilters] = useState<PointCodeFilters>(FIRST_PAGE);
  const codes = usePointCodes(client, filters);
  const totals = codes.data?.totals;
  return (
    <div className="flex flex-col gap-5">
      <PointBanner />
      <Card>
        <CardHeader icon={<Coins className="size-5" />} title="포인트 현황" />
        <QueryBoundary
          status={toBoundaryStatus(codes.status)}
          isEmpty={false}
          onRetry={() => void codes.refetch()}
          emptyTitle=""
          loadingLabel="포인트 현황을 불러오는 중이에요"
        >
          {totals ? (
            <StatRow>
              <StatFigure value={formatWon(totals.issued)} label="발급된 포인트" />
              <StatFigure value={formatWon(totals.used)} label="사용된 포인트" />
              <StatFigure value={formatWon(totals.remaining)} label="고객 잔여 포인트" />
            </StatRow>
          ) : null}
        </QueryBoundary>
      </Card>
      <PointPolicyCard />
      <div className="grid gap-5 xl:grid-cols-2">
        <PointIssueCard />
        <PointLookupCard />
      </div>
      <PointCodesTable
        status={toBoundaryStatus(codes.status)}
        list={codes.data ?? null}
        filters={filters}
        onFilters={setFilters}
        onRetry={() => void codes.refetch()}
      />
    </div>
  );
}
