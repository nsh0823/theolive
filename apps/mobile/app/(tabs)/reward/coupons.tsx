import { Ticket } from 'lucide-react-native';
import { useState } from 'react';

import { COUPON_STATUS_LABEL, CouponCard } from '@/components/reward/CouponCard';
import { Chip } from '@/components/ui/Chip';
import { ChipRow } from '@/components/ui/ChipRow';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { useCouponsQuery } from '@/fixtures/queries';
import { COUPON_STATUS, type CouponStatus } from '@/models';

const FILTERS: CouponStatus[] = [
  COUPON_STATUS.AVAILABLE,
  COUPON_STATUS.USED,
  COUPON_STATUS.EXPIRED,
];

/** RW-03: available / used / expired are separated. */
export default function CouponsScreen() {
  const state = useCouponsQuery();
  const [filter, setFilter] = useState<CouponStatus>(COUPON_STATUS.AVAILABLE);

  return (
    <Screen>
      <ChipRow>
        {FILTERS.map((status) => (
          <Chip
            key={status}
            label={COUPON_STATUS_LABEL[status]}
            selected={filter === status}
            onPress={() => setFilter(status)}
          />
        ))}
      </ChipRow>
      <QueryBoundary
        state={state}
        isEmpty={(coupons) => coupons.filter((c) => c.status === filter).length === 0}
        emptyMessage={`${COUPON_STATUS_LABEL[filter]} 쿠폰이 없어요.`}
        emptyIcon={Ticket}
      >
        {(coupons) =>
          coupons
            .filter((c) => c.status === filter)
            .map((coupon) => <CouponCard key={coupon.id} coupon={coupon} />)
        }
      </QueryBoundary>
    </Screen>
  );
}
