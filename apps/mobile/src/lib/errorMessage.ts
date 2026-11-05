import { AppError, isNetworkError, PointCodeRejectedError } from '@theolive/api';
import { APP_ERROR, APP_ERROR_MESSAGE, type AppErrorCode } from '@theolive/types';

const OFFLINE_MESSAGE = '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
const SECONDS_PER_MINUTE = 60;

/** Errors after which the menu on screen is out of date (an item sold out, was hidden, or the store closed). */
const MENU_STALE_CODES: readonly AppErrorCode[] = [
  APP_ERROR.ITEM_SOLD_OUT,
  APP_ERROR.ITEM_UNAVAILABLE,
  APP_ERROR.INVALID_TEMPERATURE,
  APP_ERROR.STORE_CLOSED,
  APP_ERROR.NOT_ACCEPTING_ORDERS,
];

/** Errors after which the wallet on screen is out of date (the coupon was used, expired or is not allowed here). */
const COUPON_STALE_CODES: readonly AppErrorCode[] = [
  APP_ERROR.COUPON_NOT_USABLE,
  APP_ERROR.COUPON_EXPIRED,
];

export function errorCode(error: unknown): AppErrorCode | null {
  return error instanceof AppError ? error.code : null;
}

/** Plain-language message for anything a mutation can throw. Details go to the log, not the screen. */
export function userMessage(error: unknown): string {
  if (isNetworkError(error)) return OFFLINE_MESSAGE;
  if (
    error instanceof PointCodeRejectedError &&
    error.code === APP_ERROR.TOO_MANY_ATTEMPTS &&
    error.retryAfterSeconds !== null
  ) {
    const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / SECONDS_PER_MINUTE));
    return `코드를 여러 번 잘못 입력했어요. ${minutes}분 뒤에 다시 시도해 주세요.`;
  }
  const code = errorCode(error);
  return APP_ERROR_MESSAGE[code ?? APP_ERROR.INTERNAL];
}

export function makesCouponStale(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && COUPON_STALE_CODES.includes(code);
}

/** Errors after which the points on screen are out of date (spent elsewhere, ended, or the rules changed). */
const POINTS_STALE_CODES: readonly AppErrorCode[] = [
  APP_ERROR.POINTS_EXCEED_BALANCE,
  APP_ERROR.POINTS_EXCEED_PAYABLE,
  APP_ERROR.POINTS_BELOW_MINIMUM,
];

export function makesPointsStale(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && POINTS_STALE_CODES.includes(code);
}

export function makesMenuStale(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && MENU_STALE_CODES.includes(code);
}
