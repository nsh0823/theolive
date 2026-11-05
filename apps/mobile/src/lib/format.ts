const KOREAN_WON_SUFFIX = '원';

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}${KOREAN_WON_SUFFIX}`;
}

export function formatSignedWon(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatWon(Math.abs(amount))}`;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** "2026.11.04 13:50" in the device's local time; empty for an unreadable timestamp. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const KST_OFFSET_HOURS = 9;

/** "2026.11.04" for the Korean calendar day (KST) the instant falls on; empty for an unreadable timestamp. */
export function formatKstDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const kst = new Date(date.getTime() + KST_OFFSET_HOURS * MS_PER_HOUR);
  return `${kst.getUTCFullYear()}.${pad2(kst.getUTCMonth() + 1)}.${pad2(kst.getUTCDate())}`;
}

/**
 * A coupon stops working at midnight KST after its last valid day, so the day to show is the one just before
 * that instant (a coupon that is valid "until 11.30" expires at 12.01 00:00).
 */
export function formatCouponExpiry(expiresAtIso: string): string {
  const expires = new Date(expiresAtIso);
  if (Number.isNaN(expires.getTime())) return '';
  return formatKstDate(new Date(expires.getTime() - 1).toISOString());
}
