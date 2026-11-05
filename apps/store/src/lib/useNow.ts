import { useEffect, useState } from 'react';
import { MS_PER_SECOND } from '@/lib/time';

const NOW_TICK_MS = 15 * MS_PER_SECOND;

/** Re-renders on an interval so elapsed times stay fresh. Elapsed values are always derived from timestamps. */
export function useNow(intervalMs: number = NOW_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
