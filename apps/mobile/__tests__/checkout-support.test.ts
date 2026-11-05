import { cartLineProblem, pruneCart, removeSoldOut } from '@/lib/cartPruning';
import { checkoutFingerprint, toCheckoutInput } from '@/lib/checkoutRequest';
import {
  availabilityOf,
  NOT_ACCEPTING_MESSAGE,
  STORE_CLOSED_MESSAGE,
} from '@/lib/storeAvailability';
import { createRequestId } from '@/lib/uuid';
import { refundNote, rejectReasonText } from '@/lib/labels';
import { makesMenuStale, userMessage } from '@/lib/errorMessage';
import { useCheckoutAttemptStore } from '@/store/useCheckoutAttemptStore';
import { AppError } from '@theolive/api';
import { TEST_MENU } from '../test-utils/testMenu';

describe('cart pruning (against the server menu)', () => {
  const ok = { menuItemId: 'americano', temperature: 'HOT' as const, quantity: 1 };
  const soldOut = { menuItemId: 'vanilla-latte', temperature: 'HOT' as const, quantity: 1 };
  const archived = { menuItemId: 'archived-item', temperature: 'HOT' as const, quantity: 1 };
  const wrongTemperature = { menuItemId: 'cold-brew', temperature: 'HOT' as const, quantity: 1 };
  const lines = [ok, soldOut, archived, wrongTemperature];

  it('classifies each line', () => {
    expect(cartLineProblem(ok, TEST_MENU)).toBeNull();
    expect(cartLineProblem(soldOut, TEST_MENU)).toBe('SOLD_OUT');
    expect(cartLineProblem(archived, TEST_MENU)).toBe('UNAVAILABLE');
    // Cold brew is only sold ICE.
    expect(cartLineProblem(wrongTemperature, TEST_MENU)).toBe('UNAVAILABLE');
  });

  it('drops hidden/archived lines, keeps sold-out ones flagged, and one tap removes them', () => {
    const pruned = pruneCart(lines, TEST_MENU);
    expect(pruned.removed.map((l) => l.menuItemId)).toEqual(['archived-item', 'cold-brew']);
    expect(pruned.kept.map((l) => l.menuItemId)).toEqual(['americano', 'vanilla-latte']);
    expect(pruned.hasSoldOut).toBe(true);
    expect(removeSoldOut(pruned.kept, TEST_MENU).map((l) => l.menuItemId)).toEqual(['americano']);
  });

  it('leaves a clean cart alone', () => {
    const clean = [{ menuItemId: 'bottled-water', temperature: null, quantity: 2 }];
    expect(pruneCart(clean, TEST_MENU)).toEqual({ kept: clean, removed: [], hasSoldOut: false });
  });
});

describe('checkout request', () => {
  const lines = [{ menuItemId: 'americano', temperature: 'ICE' as const, quantity: 2 }];

  it('carries ids, temperature and quantity only: no prices, no coupon, no points', () => {
    const body = toCheckoutInput({
      clientRequestId: 'id-1',
      lines,
      orderType: 'DINE_IN',
      method: 'CARD',
    });
    expect(body).toEqual({
      clientRequestId: 'id-1',
      orderType: 'DINE_IN',
      lines: [{ menuItemId: 'americano', temperature: 'ICE', quantity: 2 }],
      userCouponId: null,
      pointsToUse: 0,
      paymentMethod: 'CARD',
      note: null,
    });
  });

  it('keeps one idempotency key for the same request and makes a new one when it changes', () => {
    const { idFor, reset } = useCheckoutAttemptStore.getState();
    reset();
    const first = idFor(checkoutFingerprint(lines, 'TAKEOUT', 'CARD'));
    expect(idFor(checkoutFingerprint(lines, 'TAKEOUT', 'CARD'))).toBe(first);
    expect(idFor(checkoutFingerprint(lines, 'DINE_IN', 'CARD'))).not.toBe(first);
    const current = idFor(checkoutFingerprint(lines, 'DINE_IN', 'CARD'));
    reset();
    expect(idFor(checkoutFingerprint(lines, 'DINE_IN', 'CARD'))).not.toBe(current);
  });
});

describe('createRequestId', () => {
  it('uses the platform uuid when there is one', () => {
    expect(createRequestId({ randomUUID: () => 'platform-id' })).toBe('platform-id');
  });
  it('falls back to a valid v4 uuid, different each time', () => {
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = createRequestId({});
    expect(a).toMatch(pattern);
    expect(createRequestId({})).not.toBe(a);
  });
});

describe('store availability', () => {
  it('blocks ordering when closed or paused and stays permissive while unknown', () => {
    expect(availabilityOf({ isOpen: true, isAcceptingOrders: true })).toEqual({
      canOrder: true,
      message: null,
    });
    expect(availabilityOf({ isOpen: false, isAcceptingOrders: true }).message).toBe(
      STORE_CLOSED_MESSAGE,
    );
    expect(availabilityOf({ isOpen: true, isAcceptingOrders: false })).toEqual({
      canOrder: false,
      message: NOT_ACCEPTING_MESSAGE,
    });
    expect(availabilityOf(null).canOrder).toBe(true);
  });
});

describe('order wording', () => {
  it('shows refund progress for cancelled and rejected orders only', () => {
    expect(refundNote('REJECTED', 'PAID')).toBe('환불 진행 중');
    expect(refundNote('CANCELLED', 'REFUNDED')).toBe('환불 완료');
    expect(refundNote('CANCELLED', 'CANCELLED')).toBeNull();
    expect(refundNote('PAID', 'PAID')).toBeNull();
  });
  it('explains reject reasons', () => {
    expect(rejectReasonText('SOLD_OUT', null)).toBe('재료가 소진되었어요');
    expect(rejectReasonText('OTHER', '재료 소진')).toBe('재료 소진');
    expect(rejectReasonText(null, null)).toBeNull();
  });
  it('maps server errors to Korean messages and flags stale menus', () => {
    expect(userMessage(new AppError('ITEM_SOLD_OUT'))).toBe('품절된 메뉴가 있어요.');
    expect(userMessage(new Error('Network request failed'))).toContain('인터넷');
    expect(makesMenuStale(new AppError('ITEM_UNAVAILABLE'))).toBe(true);
    expect(makesMenuStale(new AppError('EMPTY_CART'))).toBe(false);
  });
});
