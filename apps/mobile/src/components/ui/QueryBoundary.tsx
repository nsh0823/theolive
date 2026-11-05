import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

import type { QueryState } from '@/lib/queryState';

import { EmptyView, ErrorView, LoadingView } from './StateViews';

type Props<T> = {
  state: QueryState<T>;
  isEmpty?: (data: T) => boolean;
  emptyMessage: string;
  emptyIcon?: LucideIcon;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  children: (data: T) => ReactNode;
};

/** Renders the loading / error / empty / success states for one query. */
export function QueryBoundary<T>({
  state,
  isEmpty,
  emptyMessage,
  emptyIcon,
  emptyActionLabel,
  onEmptyAction,
  children,
}: Props<T>) {
  if (state.status === 'loading') return <LoadingView />;
  if (state.status === 'error')
    return <ErrorView message={state.message} onRetry={state.refetch} />;
  if (isEmpty?.(state.data)) {
    return (
      <EmptyView
        message={emptyMessage}
        icon={emptyIcon}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }
  return <>{children(state.data)}</>;
}

export const isEmptyList = (data: readonly unknown[]) => data.length === 0;
