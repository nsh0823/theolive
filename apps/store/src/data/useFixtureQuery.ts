import { useCallback, useEffect, useState } from 'react';
import { useStoreValue, type Store } from './createStore';

export const QUERY_STATUS = { LOADING: 'loading', ERROR: 'error', SUCCESS: 'success' } as const;
export type QueryStatus = (typeof QUERY_STATUS)[keyof typeof QUERY_STATUS];

export type QueryResult<T> = {
  status: QueryStatus;
  data: T;
  refetch: () => void;
};

const DEFAULT_FIXTURE_LATENCY_MS = 350;
let fixtureLatencyMs = DEFAULT_FIXTURE_LATENCY_MS;

/** Tests set this to 0 so fixture queries settle immediately. */
export function setFixtureLatency(ms: number): void {
  fixtureLatencyMs = ms;
}

const DEMO_STATE_PARAM = 'state';
const DEMO_STATE = { LOADING: 'loading', ERROR: 'error', EMPTY: 'empty' } as const;

/** Fixture-only: `?state=loading|error|empty` forces a view state so every state can be reviewed. */
function readDemoState(): string | null {
  return new URLSearchParams(window.location.search).get(DEMO_STATE_PARAM);
}

/**
 * Query-shaped hook over a fixture store: `{ status, data, refetch }`, like a TanStack Query result.
 * Swap the body for a `packages/api` hook later; callers keep the same shape.
 */
export function useFixtureQuery<T>(store: Store<T>, emptyValue: T): QueryResult<T> {
  const stored = useStoreValue(store);
  const [status, setStatus] = useState<QueryStatus>(QUERY_STATUS.LOADING);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const demo = readDemoState();
      setStatus(demo === DEMO_STATE.ERROR ? QUERY_STATUS.ERROR : QUERY_STATUS.SUCCESS);
    }, fixtureLatencyMs);
    return () => window.clearTimeout(timer);
  }, [fetchCount]);

  const refetch = useCallback(() => {
    setStatus(QUERY_STATUS.LOADING);
    setFetchCount((count) => count + 1);
  }, []);

  const demo = readDemoState();
  if (demo === DEMO_STATE.LOADING)
    return { status: QUERY_STATUS.LOADING, data: emptyValue, refetch };
  const data = demo === DEMO_STATE.EMPTY ? emptyValue : stored;
  return { status, data, refetch };
}
