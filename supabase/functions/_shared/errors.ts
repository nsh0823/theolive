// Error codes returned by the payment Edge Functions: `{ error: { code, message } }`.
// The code set mirrors APP_ERROR in packages/types (a function cannot import outside supabase/functions).

export const HTTP = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
  BAD_GATEWAY: 502,
} as const;

type ErrorSpec = { status: number; message: string };

export const ERRORS = {
  UNAUTHENTICATED: { status: HTTP.UNAUTHORIZED, message: '로그인이 필요해요.' },
  FORBIDDEN: { status: HTTP.FORBIDDEN, message: '이 작업을 할 권한이 없어요.' },
  NOT_FOUND: { status: HTTP.NOT_FOUND, message: '요청한 정보를 찾을 수 없어요.' },
  INVALID_INPUT: { status: HTTP.BAD_REQUEST, message: '입력한 내용을 확인해 주세요.' },
  STORE_CLOSED: { status: HTTP.CONFLICT, message: '지금은 매장이 영업 중이 아니에요.' },
  NOT_ACCEPTING_ORDERS: {
    status: HTTP.CONFLICT,
    message: '지금은 주문을 받지 않아요. 잠시 후 다시 시도해 주세요.',
  },
  EMPTY_CART: { status: HTTP.BAD_REQUEST, message: '장바구니가 비어 있어요.' },
  INVALID_QUANTITY: {
    status: HTTP.BAD_REQUEST,
    message: '수량은 한 메뉴당 1개에서 20개까지 담을 수 있어요.',
  },
  ITEM_UNAVAILABLE: { status: HTTP.CONFLICT, message: '지금은 주문할 수 없는 메뉴가 있어요.' },
  ITEM_SOLD_OUT: { status: HTTP.CONFLICT, message: '품절된 메뉴가 있어요.' },
  INVALID_TEMPERATURE: { status: HTTP.BAD_REQUEST, message: '선택할 수 없는 온도예요.' },
  NOTE_TOO_LONG: { status: HTTP.BAD_REQUEST, message: '요청사항은 100자 이하로 입력해 주세요.' },
  IDEMPOTENCY_CONFLICT: {
    status: HTTP.CONFLICT,
    message: '이미 처리된 주문 요청이에요. 처음부터 다시 시도해 주세요.',
  },
  COUPON_NOT_USABLE: {
    status: HTTP.CONFLICT,
    message: '이 주문에는 사용할 수 없는 쿠폰이에요.',
  },
  COUPON_EXPIRED: { status: HTTP.CONFLICT, message: '유효기간이 지난 쿠폰이에요.' },
  POINTS_EXCEED_BALANCE: {
    status: HTTP.CONFLICT,
    message: '사용할 수 있는 포인트보다 많아요.',
  },
  POINTS_EXCEED_PAYABLE: {
    status: HTTP.CONFLICT,
    message: '결제 금액보다 많은 포인트는 사용할 수 없어요.',
  },
  POINTS_BELOW_MINIMUM: {
    status: HTTP.CONFLICT,
    message: '최소 사용 금액보다 적어서 포인트를 사용할 수 없어요.',
  },
  PAYMENT_NOT_APPROVED: { status: HTTP.PAYMENT_REQUIRED, message: '결제가 승인되지 않았어요.' },
  PAYMENT_AMOUNT_MISMATCH: {
    status: HTTP.CONFLICT,
    message: '결제 금액이 주문 금액과 달라 취소했어요.',
  },
  PAYMENT_EXPIRED: {
    status: HTTP.CONFLICT,
    message: '결제 가능 시간이 지나 주문이 취소되었어요. 결제 금액은 환불돼요.',
  },
  PAYMENT_PROVIDER_UNAVAILABLE: {
    status: HTTP.BAD_GATEWAY,
    message: '결제 서비스에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.',
  },
  NOT_REFUNDABLE: { status: HTTP.CONFLICT, message: '환불할 수 없는 주문이에요.' },
  REFUND_FAILED: {
    status: HTTP.BAD_GATEWAY,
    message: '환불 처리에 실패했어요. 잠시 후 다시 시도해 주세요.',
  },
  TEST_PG_DISABLED: { status: HTTP.FORBIDDEN, message: '테스트 결제가 꺼져 있어요.' },
  WEBHOOK_SIGNATURE_INVALID: { status: HTTP.UNAUTHORIZED, message: '서명이 올바르지 않아요.' },
  STAFF_ACCOUNT_NOT_ALLOWED: {
    status: HTTP.FORBIDDEN,
    message: '직원 계정은 고객 앱에서 사용할 수 없어요. 고객 계정으로 로그인해 주세요.',
  },
  ACTIVE_ORDER_EXISTS: {
    status: HTTP.CONFLICT,
    message: '진행 중인 주문이 있어서 탈퇴할 수 없어요. 주문이 끝난 뒤에 다시 시도해 주세요.',
  },
  INTERNAL: { status: HTTP.INTERNAL, message: '문제가 생겼어요. 잠시 후 다시 시도해 주세요.' },
} as const satisfies Record<string, ErrorSpec>;

export type ErrorCode = keyof typeof ERRORS;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERRORS;
}

/** A failure the handler wants to answer with a specific code. Anything else becomes INTERNAL. */
export class HttpError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code);
    this.name = 'HttpError';
    this.code = code;
  }
}

/** Reads the application code an RPC raised (`raise exception ... message = '<CODE>'`). */
export function codeFromRpcError(error: { message?: string } | null): ErrorCode {
  return error && isErrorCode(error.message) ? error.message : 'INTERNAL';
}
