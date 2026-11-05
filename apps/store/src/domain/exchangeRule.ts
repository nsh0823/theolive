export const EXCHANGE_STAMPS_MAX = 99;
export const EXCHANGE_VALID_DAYS_MAX = 365;
export const COUPON_TITLE_MAX_LENGTH = 30;

export type ExchangeRuleValues = {
  requiredText: string;
  couponTitle: string;
  validDaysText: string;
};
export type ExchangeRuleErrors = Partial<Record<'required' | 'title' | 'validDays', string>>;
export type ExchangeRuleResult =
  | { ok: true; requiredStamps: number; couponTitle: string; validDays: number }
  | { ok: false; errors: ExchangeRuleErrors };

function isWholeNumberInRange(value: string, max: number): boolean {
  const n = Number(value);
  return value.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= max;
}

export function validateExchangeRule(values: ExchangeRuleValues): ExchangeRuleResult {
  const errors: ExchangeRuleErrors = {};
  if (!isWholeNumberInRange(values.requiredText, EXCHANGE_STAMPS_MAX))
    errors.required = `1~${EXCHANGE_STAMPS_MAX} 사이의 숫자로 입력해 주세요.`;
  const title = values.couponTitle.trim();
  if (title === '' || title.length > COUPON_TITLE_MAX_LENGTH)
    errors.title = `쿠폰 이름을 ${COUPON_TITLE_MAX_LENGTH}자 이내로 입력해 주세요.`;
  if (!isWholeNumberInRange(values.validDaysText, EXCHANGE_VALID_DAYS_MAX))
    errors.validDays = `1~${EXCHANGE_VALID_DAYS_MAX}일 사이로 입력해 주세요.`;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    requiredStamps: Number(values.requiredText),
    couponTitle: title,
    validDays: Number(values.validDaysText),
  };
}
