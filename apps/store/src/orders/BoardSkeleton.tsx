import { BOARD_STATUSES } from '@/domain/orderTransitions';

const SKELETON_CARDS = 2;

export function BoardSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-4 sm:px-6 sm:pb-6"
      aria-hidden="true"
    >
      {BOARD_STATUSES.map((status) => (
        <div
          key={status}
          className="flex min-w-[17.5rem] flex-1 flex-col gap-3 rounded-2xl border border-border bg-card/60 p-3"
        >
          <div className="h-10 animate-pulse rounded-xl bg-secondary motion-reduce:animate-none" />
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl bg-card motion-reduce:animate-none"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
