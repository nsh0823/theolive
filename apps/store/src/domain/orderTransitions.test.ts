import { describe, expect, it } from 'vitest';
import { ORDER_STATUS, type OrderStatus } from './models';
import {
  ORDER_TRANSITIONS,
  STAFF_ACTION,
  applyStaffAction,
  availableStaffActions,
  canTransition,
} from './orderTransitions';

describe('order transitions (PRD 7.1)', () => {
  it('follows the happy path PAID -> ACCEPTED -> PREPARING -> READY -> COMPLETED', () => {
    const path = [
      ORDER_STATUS.PAID,
      ORDER_STATUS.ACCEPTED,
      ORDER_STATUS.PREPARING,
      ORDER_STATUS.READY,
    ];
    const actions = [
      STAFF_ACTION.ACCEPT,
      STAFF_ACTION.START_PREPARING,
      STAFF_ACTION.MARK_READY,
      STAFF_ACTION.COMPLETE,
    ];
    let current: OrderStatus = path[0] ?? ORDER_STATUS.PAID;
    for (const action of actions) {
      const result = applyStaffAction(current, action);
      expect(result.ok).toBe(true);
      if (result.ok) current = result.status;
    }
    expect(current).toBe(ORDER_STATUS.COMPLETED);
  });

  it('offers only valid actions per status', () => {
    expect(availableStaffActions(ORDER_STATUS.PAID)).toEqual([
      STAFF_ACTION.ACCEPT,
      STAFF_ACTION.REJECT,
    ]);
    expect(availableStaffActions(ORDER_STATUS.ACCEPTED)).toEqual([STAFF_ACTION.START_PREPARING]);
    expect(availableStaffActions(ORDER_STATUS.PREPARING)).toEqual([STAFF_ACTION.MARK_READY]);
    expect(availableStaffActions(ORDER_STATUS.READY)).toEqual([STAFF_ACTION.COMPLETE]);
  });

  it('offers no actions on terminal or unpaid statuses', () => {
    for (const status of [
      ORDER_STATUS.COMPLETED,
      ORDER_STATUS.REJECTED,
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.PENDING_PAYMENT,
    ]) {
      expect(availableStaffActions(status)).toEqual([]);
    }
  });

  it('rejects only from PAID (new orders)', () => {
    expect(applyStaffAction(ORDER_STATUS.PAID, STAFF_ACTION.REJECT)).toEqual({
      ok: true,
      status: ORDER_STATUS.REJECTED,
    });
    expect(applyStaffAction(ORDER_STATUS.ACCEPTED, STAFF_ACTION.REJECT).ok).toBe(false);
  });

  it('refuses skipped or backward steps', () => {
    expect(applyStaffAction(ORDER_STATUS.PAID, STAFF_ACTION.START_PREPARING).ok).toBe(false);
    expect(applyStaffAction(ORDER_STATUS.ACCEPTED, STAFF_ACTION.COMPLETE).ok).toBe(false);
    expect(applyStaffAction(ORDER_STATUS.READY, STAFF_ACTION.ACCEPT).ok).toBe(false);
    expect(applyStaffAction(ORDER_STATUS.COMPLETED, STAFF_ACTION.MARK_READY)).toEqual({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
  });

  it('keeps the PRD table: terminal states have no exits', () => {
    expect(ORDER_TRANSITIONS[ORDER_STATUS.COMPLETED]).toEqual([]);
    expect(ORDER_TRANSITIONS[ORDER_STATUS.REJECTED]).toEqual([]);
    expect(canTransition(ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED)).toBe(false);
    expect(canTransition(ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED)).toBe(true);
  });
});
