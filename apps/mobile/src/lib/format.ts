const KOREAN_WON_SUFFIX = '원';

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}${KOREAN_WON_SUFFIX}`;
}

export function formatSignedWon(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatWon(Math.abs(amount))}`;
}
