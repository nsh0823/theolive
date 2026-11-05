import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createOrders } from '@/test/orderFactory';
import { renderWithProviders } from '@/test/render';
import { OrderDetailBody } from './OrderDetailBody';

describe('OrderDetailBody coupon', () => {
  const base = createOrders()[0];
  if (!base) throw new Error('fixture orders missing');

  it('names the applied coupon next to the discount', () => {
    renderWithProviders(
      <OrderDetailBody
        order={{ ...base, couponDiscount: 4500, couponTitle: '아메리카노 또는 라떼 쿠폰' }}
      />,
    );
    expect(screen.getByText('쿠폰 할인 · 아메리카노 또는 라떼 쿠폰')).toBeInTheDocument();
    expect(screen.getByText('-4,500원')).toBeInTheDocument();
  });

  it('shows no coupon row when the order has none', () => {
    renderWithProviders(
      <OrderDetailBody order={{ ...base, couponDiscount: 0, couponTitle: null }} />,
    );
    expect(screen.queryByText(/쿠폰 할인/)).not.toBeInTheDocument();
  });
});

describe('OrderDetailBody Coupon Points (PAY-03)', () => {
  const base = createOrders()[0];
  if (!base) throw new Error('fixture orders missing');

  it('shows the points the customer used, apart from the coupon discount', () => {
    renderWithProviders(
      <OrderDetailBody
        order={{ ...base, couponDiscount: 3000, couponTitle: '정액 쿠폰', pointsUsed: 2500 }}
      />,
    );
    expect(screen.getByText('쿠폰 포인트 사용')).toBeInTheDocument();
    expect(screen.getByText('-2,500원')).toBeInTheDocument();
    expect(screen.getByText('-3,000원')).toBeInTheDocument();
  });

  it('shows no points row when none were used', () => {
    renderWithProviders(<OrderDetailBody order={{ ...base, pointsUsed: 0 }} />);
    expect(screen.queryByText('쿠폰 포인트 사용')).not.toBeInTheDocument();
  });
});
