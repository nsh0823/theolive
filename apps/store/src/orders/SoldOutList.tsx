import { setItemSoldOut } from '@/data/actions';
import { useCategoriesQuery, useMenuQuery } from '@/data/queries';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { Switch } from '@/ui/Switch';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { useToast } from '@/ui/Toast';
import { formatWon } from '@/lib/format';

/** Sold-out toggles. The change will reach the customer menu through the server (SW-07). */
export function SoldOutList() {
  const menu = useMenuQuery();
  const categories = useCategoriesQuery();
  const { notify } = useToast();
  const categoryName = (id: string) =>
    categories.data.find((category) => category.id === id)?.name ?? '';

  return (
    <QueryBoundary
      status={menu.status}
      isEmpty={menu.data.length === 0}
      onRetry={menu.refetch}
      emptyTitle="등록된 메뉴가 없어요"
      emptyDescription="관리자 화면에서 메뉴를 추가해 주세요."
    >
      <ul className="flex flex-col gap-2">
        {menu.data
          .filter((item) => item.isActive)
          .map((item) => (
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
                  onChange={(isSoldOut) => {
                    setItemSoldOut(item.id, isSoldOut);
                    notify(`${item.name} ${isSoldOut ? '품절로 변경했어요' : '판매 재개했어요'}`);
                  }}
                />
              </div>
            </li>
          ))}
      </ul>
    </QueryBoundary>
  );
}
