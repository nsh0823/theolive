import { Ticket } from 'lucide-react';
import { useIssuedCouponsQuery } from '@/data/queries';
import { Card, CardHeader } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { CouponStatusBadge } from '@/shared/badges';
import { formatDate } from '@/lib/format';

/** Stamp-exchange coupons only. Coupon Point codes live on their own page. */
export function IssuedCouponsCard() {
  const coupons = useIssuedCouponsQuery();
  return (
    <Card>
      <CardHeader icon={<Ticket className="size-5" />} title="발급된 교환 쿠폰" />
      <QueryBoundary
        status={coupons.status}
        isEmpty={coupons.data.length === 0}
        onRetry={coupons.refetch}
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
            {coupons.data.map((coupon) => (
              <Tr key={coupon.id}>
                <Td className="font-medium">{coupon.title}</Td>
                <Td className="tabular-nums">{formatDate(coupon.issuedAt)}</Td>
                <Td className="tabular-nums">{formatDate(coupon.expiresAt)}까지</Td>
                <Td>
                  <CouponStatusBadge status={coupon.status} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </QueryBoundary>
    </Card>
  );
}
