import { Leaf } from 'lucide-react';
import { useStampOverviewQuery, useStampPolicyQuery } from '@/data/queries';
import { Card, CardHeader, StatFigure, StatRow } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { StampBanner } from '@/shared/RewardBanners';
import { formatCount } from '@/lib/format';
import { ExchangeRulesCard } from './ExchangeRulesCard';
import { IssuedCouponsCard } from './IssuedCouponsCard';
import { StampPolicyCard } from './StampPolicyCard';

/** Olive Stamps only: policy, exchange rules, issued exchange coupons. Coupon Points are on /admin/points. */
export function RewardsPage() {
  const overview = useStampOverviewQuery();
  const policy = useStampPolicyQuery();
  return (
    <div className="flex flex-col gap-5">
      <StampBanner />
      <Card>
        <CardHeader icon={<Leaf className="size-5" />} title="스탬프 현황 (이번 달)" />
        <QueryBoundary
          status={overview.status}
          isEmpty={false}
          onRetry={overview.refetch}
          emptyTitle=""
        >
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
        </QueryBoundary>
      </Card>
      <QueryBoundary status={policy.status} isEmpty={false} onRetry={policy.refetch} emptyTitle="">
        <StampPolicyCard key={JSON.stringify(policy.data)} policy={policy.data} />
      </QueryBoundary>
      <ExchangeRulesCard />
      <IssuedCouponsCard />
    </div>
  );
}
