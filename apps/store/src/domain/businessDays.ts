import { MS_PER_DAY, MS_PER_HOUR } from '@/lib/time';

const KST_OFFSET_HOURS = 9;
const KST_OFFSET_MS = KST_OFFSET_HOURS * MS_PER_HOUR;
export const DASHBOARD_DAYS = 7;

/** The Asia/Seoul calendar date (`YYYY-MM-DD`) of an instant; the server counts sales by this day. */
export function toBusinessDate(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The last `days` business dates ending today (inclusive): `{ from, to }`. */
export function lastBusinessDays(nowMs: number, days: number = DASHBOARD_DAYS) {
  return { from: toBusinessDate(nowMs - (days - 1) * MS_PER_DAY), to: toBusinessDate(nowMs) };
}
