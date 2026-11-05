import { useIssuedCoupons } from '@theolive/api';
import { Ticket } from 'lucide-react';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { COUPON_STATUS, type CouponStatus } from '@/domain/models';
import { Card, CardHeader } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { CouponStatusBadge } from '@/shared/badges';
import { formatDate } from '@/lib/format';

/** A voided coupon is gone for good, so it reads as expired. */
function toBadgeStatus(status: string): CouponStatus {
  if (status === COUPON_STATUS.AVAILABLE || status === COUPON_STATUS.USED) return status;
  return COUPON_STATUS.EXPIRED;
}

/** Stamp-exchange coupons only. Coupon Point codes live on their own page. */
export function IssuedCouponsCard() {
  const coupons = useIssuedCoupons(useSupabase());
  const list = coupons.data ?? [];
  return (
    <Card>
      <CardHeader icon={<Ticket className="size-5" />} title="발급된 교환 쿠폰" />
      <QueryBoundary
        status={toBoundaryStatus(coupons.status)}
        isEmpty={list.length === 0}
        onRetry={() => void coupons.refetch()}
        emptyTitle="발급된 쿠폰이 없어요"
      >
        <DataTable caption="발급된 스탬프 교환 쿠폰">
          <thead>
            <tr>
              <Th>쿠폰</Th>
              <Th>발급일</Th>
              <Th>유효기간</Th>
              <Th>상태</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((coupon) => (
              <Tr key={coupon.id}>
                <Td className="font-medium">{coupon.title}</Td>
                <Td className="tabular-nums">{formatDate(coupon.issuedAt)}</Td>
                <Td className="tabular-nums">{formatDate(coupon.expiresAt)}까지</Td>
                <Td>
                  <CouponStatusBadge status={toBadgeStatus(coupon.status)} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </QueryBoundary>
    </Card>
  );
}
