export const QUERY_STATUS = { LOADING: 'loading', ERROR: 'error', SUCCESS: 'success' } as const;
export type QueryStatus = (typeof QUERY_STATUS)[keyof typeof QUERY_STATUS];

export type QueryResult<T> = {
  status: QueryStatus;
  data: T;
  refetch: () => void;
};

type TanStackStatus = 'pending' | 'error' | 'success';

/** Maps a TanStack Query status onto the status vocabulary `QueryBoundary` uses. */
export function toBoundaryStatus(status: TanStackStatus): QueryStatus {
  if (status === 'pending') return QUERY_STATUS.LOADING;
  if (status === 'error') return QUERY_STATUS.ERROR;
  return QUERY_STATUS.SUCCESS;
}
