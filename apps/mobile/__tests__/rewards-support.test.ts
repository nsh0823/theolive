import { AppError } from '@theolive/api';

import { checkoutFingerprint, toCheckoutInput } from '@/lib/checkoutRequest';
import { makesCouponStale, userMessage } from '@/lib/errorMessage';
import { formatCouponExpiry, formatKstDate } from '@/lib/format';
import { couponBenefitLabel } from '@/lib/labels';

describe('coupon wording (RW-03)', () => {
  it('says what each benefit is', () => {
    expect(couponBenefitLabel({ benefitType: 'FIXED_AMOUNT', discountAmount: 3000 })).toBe(
      '3,000원 할인',
    );
    expect(couponBenefitLabel({ benefitType: 'FREE_ITEM', discountAmount: null })).toBe('1잔 무료');
    expect(couponBenefitLabel({ benefitType: 'FREE_ITEM', discountAmount: 5000 })).toBe(
      '최대 5,000원 무료',
    );
  });
});

describe('Korean calendar dates', () => {
  it('formats the KST day of an instant', () => {
    // 2026-11-04 16:00 UTC is already 2026-11-05 in Korea.
    expect(formatKstDate('2026-11-04T16:00:00.000Z')).toBe('2026.11.05');
    expect(formatKstDate('2026-11-04T14:59:59.000Z')).toBe('2026.11.04');
    expect(formatKstDate('not a date')).toBe('');
  });
  it('shows the last valid day of a coupon (it ends at midnight KST after that day)', () => {
    // Expires 2026-12-01 00:00 KST = 2026-11-30 15:00 UTC, so the last valid day is 11.30.
    expect(formatCouponExpiry('2026-11-30T15:00:00.000Z')).toBe('2026.11.30');
    expect(formatCouponExpiry('nope')).toBe('');
  });
});

describe('checkout with a coupon', () => {
  const lines = [{ menuItemId: 'americano', temperature: 'HOT' as const, quantity: 2 }];

  it('sends only the coupon id: no discount amount', () => {
    const body = toCheckoutInput({
      clientRequestId: 'id-1',
      lines,
      orderType: 'TAKEOUT',
      method: 'CARD',
      userCouponId: 'coupon-1',
    });
    expect(body.userCouponId).toBe('coupon-1');
    expect(Object.keys(body).sort()).toEqual(
      [
        'clientRequestId',
        'lines',
        'note',
        'orderType',
        'paymentMethod',
        'pointsToUse',
        'userCouponId',
      ].sort(),
    );
  });

  it('is a different request (new idempotency key) when the coupon changes', () => {
    const none = checkoutFingerprint(lines, 'TAKEOUT', 'CARD');
    expect(checkoutFingerprint(lines, 'TAKEOUT', 'CARD', null)).toBe(none);
    expect(checkoutFingerprint(lines, 'TAKEOUT', 'CARD', 'coupon-1')).not.toBe(none);
  });

  it('explains coupon rejections in plain language and flags a stale wallet', () => {
    expect(userMessage(new AppError('COUPON_EXPIRED'))).toBe('유효기간이 지난 쿠폰이에요.');
    expect(userMessage(new AppError('COUPON_NOT_USABLE'))).toBe(
      '이 주문에는 사용할 수 없는 쿠폰이에요.',
    );
    expect(userMessage(new AppError('INSUFFICIENT_STAMPS'))).toBe('스탬프가 부족해요.');
    expect(makesCouponStale(new AppError('COUPON_EXPIRED'))).toBe(true);
    expect(makesCouponStale(new AppError('COUPON_NOT_USABLE'))).toBe(true);
    expect(makesCouponStale(new AppError('ITEM_SOLD_OUT'))).toBe(false);
  });
});
