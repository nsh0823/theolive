import { ORDER_STATUS, type OrderStatus } from './models';

/**
 * Full PRD 7.1 transition table. Used to validate any status change.
 * CANCELLED and the payment-side states are driven by the customer app or the server, not by staff here.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY],
  [ORDER_STATUS.READY]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.REJECTED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

export const STAFF_ACTION = {
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
  START_PREPARING: 'START_PREPARING',
  MARK_READY: 'MARK_READY',
  COMPLETE: 'COMPLETE',
} as const;
export type StaffAction = (typeof STAFF_ACTION)[keyof typeof STAFF_ACTION];

export const STAFF_ACTION_LABEL: Record<StaffAction, string> = {
  [STAFF_ACTION.ACCEPT]: '접수하기',
  [STAFF_ACTION.REJECT]: '주문 거절',
  [STAFF_ACTION.START_PREPARING]: '준비 시작',
  [STAFF_ACTION.MARK_READY]: '준비 완료',
  [STAFF_ACTION.COMPLETE]: '수령 완료',
};

/** Target status of each staff action (brief + PRD 5.7 SW-03/SW-04). */
const ACTION_TARGET: Record<StaffAction, OrderStatus> = {
  [STAFF_ACTION.ACCEPT]: ORDER_STATUS.ACCEPTED,
  [STAFF_ACTION.REJECT]: ORDER_STATUS.REJECTED,
  [STAFF_ACTION.START_PREPARING]: ORDER_STATUS.PREPARING,
  [STAFF_ACTION.MARK_READY]: ORDER_STATUS.READY,
  [STAFF_ACTION.COMPLETE]: ORDER_STATUS.COMPLETED,
};

const ACTION_SOURCE: Record<StaffAction, OrderStatus> = {
  [STAFF_ACTION.ACCEPT]: ORDER_STATUS.PAID,
  [STAFF_ACTION.REJECT]: ORDER_STATUS.PAID,
  [STAFF_ACTION.START_PREPARING]: ORDER_STATUS.ACCEPTED,
  [STAFF_ACTION.MARK_READY]: ORDER_STATUS.PREPARING,
  [STAFF_ACTION.COMPLETE]: ORDER_STATUS.READY,
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Staff actions that are valid for an order in `status`, primary action first. */
export function availableStaffActions(status: OrderStatus): StaffAction[] {
  const actions: StaffAction[] = [
    STAFF_ACTION.ACCEPT,
    STAFF_ACTION.START_PREPARING,
    STAFF_ACTION.MARK_READY,
    STAFF_ACTION.COMPLETE,
    STAFF_ACTION.REJECT,
  ];
  return actions.filter(
    (action) => ACTION_SOURCE[action] === status && canTransition(status, ACTION_TARGET[action]),
  );
}

export type TransitionResult =
  { ok: true; status: OrderStatus } | { ok: false; reason: 'INVALID_TRANSITION' };

/** Pure transition function: returns the next status or a failure, never throws. */
export function applyStaffAction(status: OrderStatus, action: StaffAction): TransitionResult {
  if (ACTION_SOURCE[action] !== status || !canTransition(status, ACTION_TARGET[action])) {
    return { ok: false, reason: 'INVALID_TRANSITION' };
  }
  return { ok: true, status: ACTION_TARGET[action] };
}

/** The four board columns, in order (brief: 신규 주문 / 접수 완료 / 준비 중 / 준비 완료). */
export const BOARD_STATUSES = [
  ORDER_STATUS.PAID,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
] as const;
