import { POINT_CODE_STATUS, type PointCode } from './models';

export const POINT_AMOUNT_MIN = 1000;
export const POINT_AMOUNT_MAX = 100000;
export const POINT_QUANTITY_MAX = 50;
export const POINT_MEMO_MAX_LENGTH = 40;

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_SEGMENT_LENGTH = 4;
const SEED_MULTIPLIER = 1103515245;
const SEED_INCREMENT = 12345;
const SEED_MODULUS = 2 ** 31;

/**
 * Fixture-only code generator. Real codes must be generated on the server (unguessable, unique, never client-made).
 */
export function generateFixtureCode(seed: number): string {
  let state = seed;
  const chars: string[] = [];
  for (let i = 0; i < CODE_SEGMENT_LENGTH * 2; i += 1) {
    state = (state * SEED_MULTIPLIER + SEED_INCREMENT) % SEED_MODULUS;
    chars.push(CODE_ALPHABET.charAt(Math.floor(state / 65536) % CODE_ALPHABET.length));
  }
  return `OLIVE-${chars.slice(0, CODE_SEGMENT_LENGTH).join('')}-${chars.slice(CODE_SEGMENT_LENGTH).join('')}`;
}

export type PointIssueValues = {
  amountText: string;
  quantityText: string;
  expiresOn: string;
  memo: string;
};
export type PointIssueErrors = Partial<
  Record<'amount' | 'quantity' | 'expiresOn' | 'memo', string>
>;
export type PointIssueResult =
  | { ok: true; amount: number; quantity: number; expiresOn: string; memo: string }
  | { ok: false; errors: PointIssueErrors };

/** `todayKey` and `expiresOn` are `YYYY-MM-DD`. */
export function validatePointIssue(values: PointIssueValues, todayKey: string): PointIssueResult {
  const errors: PointIssueErrors = {};
  const amount = Number(values.amountText);
  const quantity = Number(values.quantityText);
  if (
    values.amountText.trim() === '' ||
    !Number.isInteger(amount) ||
    amount < POINT_AMOUNT_MIN ||
    amount > POINT_AMOUNT_MAX
  ) {
    errors.amount = `${POINT_AMOUNT_MIN.toLocaleString('ko-KR')}원 이상 ${POINT_AMOUNT_MAX.toLocaleString('ko-KR')}원 이하로 입력해 주세요.`;
  }
  if (
    values.quantityText.trim() === '' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > POINT_QUANTITY_MAX
  ) {
    errors.quantity = `1~${POINT_QUANTITY_MAX}개 사이로 입력해 주세요.`;
  }
  if (values.expiresOn === '' || values.expiresOn <= todayKey)
    errors.expiresOn = '오늘 이후 날짜를 선택해 주세요.';
  if (values.memo.length > POINT_MEMO_MAX_LENGTH)
    errors.memo = `메모는 ${POINT_MEMO_MAX_LENGTH}자 이내로 입력해 주세요.`;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, amount, quantity, expiresOn: values.expiresOn, memo: values.memo.trim() };
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export function findPointCode(codes: readonly PointCode[], input: string): PointCode | null {
  const needle = normalizeCode(input);
  return needle === '' ? null : (codes.find((code) => code.code === needle) ?? null);
}

export type PointTotals = { issued: number; used: number; remaining: number };

/** Totals count only codes that were registered; unregistered codes hold no customer balance. */
export function totalPoints(codes: readonly PointCode[]): PointTotals {
  const issued = codes.reduce((sum, code) => sum + code.amount, 0);
  const registered = codes.filter(
    (c) => c.status === POINT_CODE_STATUS.REGISTERED || c.status === POINT_CODE_STATUS.EXHAUSTED,
  );
  const used = registered.reduce((sum, code) => sum + (code.amount - code.remaining), 0);
  const remaining = registered.reduce((sum, code) => sum + code.remaining, 0);
  return { issued, used, remaining };
}
