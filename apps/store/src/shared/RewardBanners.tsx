import { Link } from 'react-router';
import { Coins, Leaf } from 'lucide-react';
import { ROUTES } from '@/lib/routes';

/** Olive Stamps: solid Deep Olive surface + leaf glyph + counts in 개. Never styled like Coupon Points. */
export function StampBanner() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-primary px-6 py-5 text-primary-foreground">
      <span
        className="flex size-12 items-center justify-center rounded-full bg-primary-foreground/15"
        aria-hidden="true"
      >
        <Leaf className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">올리브 스탬프</p>
        <p className="text-sm opacity-90">
          구매 실적에 따라 적립되고, 정해진 개수를 모으면 쿠폰으로 교환돼요.
        </p>
      </div>
      <Link
        to={ROUTES.ADMIN_POINTS}
        className="rounded-full px-3 py-2 text-sm font-semibold underline underline-offset-4"
      >
        쿠폰 포인트는 별도 메뉴에서 관리해요
      </Link>
    </div>
  );
}

/** Coupon Points: Warm Cream surface + coin glyph + amounts in 원. Separate balance and ledger from stamps. */
export function PointBanner() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-cream px-6 py-5 text-cream-foreground ring-1 ring-border">
      <span
        className="flex size-12 items-center justify-center rounded-full bg-card text-primary"
        aria-hidden="true"
      >
        <Coins className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">쿠폰 포인트</p>
        <p className="text-sm text-muted-foreground">
          코드로 등록해 결제 금액에서 현금처럼 차감하는 포인트예요. 스탬프와 잔액·내역이 완전히
          분리돼요.
        </p>
      </div>
      <Link
        to={ROUTES.ADMIN_REWARDS}
        className="rounded-full px-3 py-2 text-sm font-semibold text-primary underline underline-offset-4"
      >
        올리브 스탬프는 리워드 관리에서 설정해요
      </Link>
    </div>
  );
}
