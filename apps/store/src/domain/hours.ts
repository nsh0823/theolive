import type { BusinessHours } from './models';

/** Returns the weekdays whose open time is not before the close time (closed days are skipped). */
export function findInvalidHours(hours: readonly BusinessHours[]): number[] {
  // "HH:MM" strings compare correctly as text.
  return hours
    .filter((day) => !day.isClosed && day.opensAt >= day.closesAt)
    .map((day) => day.weekday);
}
