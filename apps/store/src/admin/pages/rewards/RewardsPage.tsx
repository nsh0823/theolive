import { useStampOverview, useStampPolicy } from '@theolive/api';
import { Leaf } from 'lucide-react';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { Card, CardHeader, StatFigure, StatRow } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { StampBanner } from '@/shared/RewardBanners';
import { formatCount } from '@/lib/format';
import { ExchangeRulesCard } from './ExchangeRulesCard';
import { IssuedCouponsCard } from './IssuedCouponsCard';
import { StampPolicyCard } from './StampPolicyCard';

/** Olive Stamps only: policy, exchange rules, issued exchange coupons. Coupon Points are on /admin/points. */
export function RewardsPage() {
  const client = useSupabase();
  const overview = useStampOverview(client);
  const policy = useStampPolicy(client);
  return (
    <div className="flex flex-col gap-5">
      <StampBanner />
      <Card>
        <CardHeader icon={<Leaf className="size-5" />} title="스탬프 현황 (이번 달)" />
        <QueryBoundary
          status={toBoundaryStatus(overview.status)}
          isEmpty={false}
          onRetry={() => void overview.refetch()}
          emptyTitle=""
        >
          {overview.data ? (
            <StatRow>
              <StatFigure
                value={`${formatCount(overview.data.earnedThisMonth)}개`}
                label="적립된 스탬프"
              />
              <StatFigure
                value={`${formatCount(overview.data.exchangedCoupons)}장`}
                label="교환 쿠폰 발급"
              />
              <StatFigure
                value={`${formatCount(overview.data.outstandingStamps)}개`}
                label="교환 전 보유 스탬프"
              />
            </StatRow>
          ) : null}
        </QueryBoundary>
      </Card>
      <QueryBoundary
        status={toBoundaryStatus(policy.status)}
        isEmpty={false}
        onRetry={() => void policy.refetch()}
        emptyTitle=""
      >
        <StampPolicyCard key={policy.data?.id ?? 'none'} policy={policy.data ?? null} />
      </QueryBoundary>
      <ExchangeRulesCard />
      <IssuedCouponsCard />
    </div>
  );
}
