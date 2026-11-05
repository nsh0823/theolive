import { useMenuCategories, useMenuItems, useSetSoldOut } from '@theolive/api';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { describeError } from '@/lib/errorMessage';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { Switch } from '@/ui/Switch';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { useToast } from '@/ui/Toast';
import { formatWon } from '@/lib/format';

/** Sold-out toggles (SW-07). The server decides; the list shows the refetched state, never a guess. */
export function SoldOutList() {
  const client = useSupabase();
  const menu = useMenuItems(client);
  const categories = useMenuCategories(client);
  const setSoldOut = useSetSoldOut(client);
  const { notify } = useToast();
  const items = (menu.data ?? []).filter((item) => item.isActive);
  const categoryName = (id: string) =>
    categories.data?.find((category) => category.id === id)?.name ?? '';

  return (
    <QueryBoundary
      status={toBoundaryStatus(menu.status)}
      isEmpty={items.length === 0}
      onRetry={() => void menu.refetch()}
      emptyTitle="등록된 메뉴가 없어요"
      emptyDescription="관리자 화면에서 메뉴를 추가해 주세요."
      loadingLabel="메뉴를 불러오는 중이에요"
    >
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4"
          >
            <div className="min-w-0 py-2">
              <p className="truncate text-base font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {categoryName(item.categoryId)} · {formatWon(item.price)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={item.isSoldOut ? BADGE_TONE.DANGER : BADGE_TONE.SAGE}>
                {item.isSoldOut ? '품절' : '판매 중'}
              </Badge>
              <Switch
                checked={item.isSoldOut}
                label={`품절 처리: ${item.name}`}
                disabled={setSoldOut.isPending}
                onChange={(isSoldOut) =>
                  setSoldOut.mutate(
                    { menuItemId: item.id, isSoldOut },
                    {
                      onSuccess: () =>
                        notify(
                          `${item.name} ${isSoldOut ? '품절로 변경했어요' : '판매 재개했어요'}`,
                        ),
                      onError: (error) => notify(describeError(error)),
                    },
                  )
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </QueryBoundary>
  );
}
