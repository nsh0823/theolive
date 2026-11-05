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
