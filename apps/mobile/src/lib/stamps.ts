import type { StampSummary } from '@/models';

export type StampProgress = { remaining: number; fraction: number; isComplete: boolean };

/** Display-only progress toward the next reward; the server decides eligibility (RW-02). */
export function stampProgress({ count, goal }: StampSummary): StampProgress {
  if (goal <= 0) return { remaining: 0, fraction: 0, isComplete: false };
  const clamped = Math.min(Math.max(count, 0), goal);
  return { remaining: goal - clamped, fraction: clamped / goal, isComplete: clamped >= goal };
}
