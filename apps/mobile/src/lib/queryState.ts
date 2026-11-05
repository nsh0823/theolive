import type { UseQueryResult } from '@tanstack/react-query';

/** Same shape a TanStack Query result narrows to, so screens swap in real hooks later. */
export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'offline'; refetch: () => void }
  | { status: 'error'; message: string; refetch: () => void }
  | { status: 'success'; data: T };

export function successState<T>(data: T): QueryState<T> {
  return { status: 'success', data };
}

/** Combines two queries: loading/error win over success, (offline first), so one screen section can show one state. */
export function combineStates<A, B>(a: QueryState<A>, b: QueryState<B>): QueryState<[A, B]> {
  if (a.status === 'offline') return a;
  if (b.status === 'offline') return b;
  if (a.status === 'error') return a;
  if (b.status === 'error') return b;
  if (a.status === 'loading' || b.status === 'loading') return { status: 'loading' };
  return { status: 'success', data: [a.data, b.data] };
}

const LOAD_FAILED_MESSAGE = '불러오지 못했어요. 잠시 후 다시 시도해 주세요.';

/**
 * Maps a TanStack Query result onto the screen states. A failed background refetch keeps showing the data
 * already on screen. "Offline" comes from NetInfo through TanStack Query's online manager: a query that has no
 * data and is paused is waiting for the connection, and resumes by itself on reconnect.
 */
export function toQueryState<T>(query: UseQueryResult<T, unknown>): QueryState<T> {
  const refetch = () => {
    void query.refetch();
  };
  if (query.data !== undefined) return { status: 'success', data: query.data };
  if (query.fetchStatus === 'paused') return { status: 'offline', refetch };
  if (query.isError) return { status: 'error', message: LOAD_FAILED_MESSAGE, refetch };
  return { status: 'loading' };
}
