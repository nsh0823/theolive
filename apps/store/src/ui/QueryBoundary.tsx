import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { QUERY_STATUS, type QueryStatus } from '@/data/queryStatus';
import { Button, BUTTON_VARIANT } from './Button';

type QueryBoundaryProps = {
  status: QueryStatus;
  isEmpty: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  loadingLabel?: string;
  skeleton?: ReactNode;
  children: ReactNode;
};

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">{children}</div>;
}

/** Loading, error, empty, then success: every data view goes through this (CLAUDE.md). */
export function QueryBoundary({
  status,
  isEmpty,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  loadingLabel = '불러오는 중이에요',
  skeleton,
  children,
}: QueryBoundaryProps) {
  if (status === QUERY_STATUS.LOADING) {
    return (
      <div role="status" aria-busy="true" aria-label={loadingLabel}>
        {skeleton ?? (
          <Centered>
            <RefreshCw
              className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">{loadingLabel}</p>
          </Centered>
        )}
      </div>
    );
  }
  if (status === QUERY_STATUS.ERROR) {
    return (
      <Centered>
        <AlertTriangle className="size-7 text-destructive" aria-hidden="true" />
        <p role="alert" className="font-semibold">
          데이터를 불러오지 못했어요
        </p>
        <p className="text-sm text-muted-foreground">잠시 후 다시 시도해 주세요.</p>
        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          icon={<RefreshCw className="size-4" aria-hidden="true" />}
          onClick={onRetry}
        >
          다시 시도
        </Button>
      </Centered>
    );
  }
  if (isEmpty) {
    return (
      <Centered>
        <Inbox className="size-7 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">{emptyTitle}</p>
        {emptyDescription ? (
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        ) : null}
        {emptyAction}
      </Centered>
    );
  }
  return <>{children}</>;
}
