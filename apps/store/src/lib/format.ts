import { MS_PER_MINUTE } from './time';

const wonFormatter = new Intl.NumberFormat('ko-KR');

export function formatWon(amount: number): string {
  return `${wonFormatter.format(amount)}원`;
}

export function formatCount(value: number): string {
  return wonFormatter.format(value);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

/** `YYYY-MM-DD` in local time, the format of `<input type="date">`. */
export function toDateInputValue(iso: string): string {
  return formatDate(iso).replaceAll('.', '-');
}

/** Whole minutes since `iso`, never negative. */
export function elapsedMinutes(iso: string, nowMs: number): number {
  const diff = nowMs - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / MS_PER_MINUTE));
}

export function formatElapsed(iso: string, nowMs: number): string {
  const minutes = elapsedMinutes(iso, nowMs);
  return minutes < 1 ? '방금 전' : `${minutes}분 경과`;
}
