import {
  useArchiveMenuItem,
  useMenuCategories,
  useMenuItems,
  useSaveCategories,
  useSetSoldOut,
} from '@theolive/api';
import { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { describeError } from '@/lib/errorMessage';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { useToast } from '@/ui/Toast';
import { cn } from '@/lib/cn';
import type { MenuItem } from '@/domain/models';
import { CategoryDialog } from './CategoryDialog';
import { MenuFormDialog } from './MenuFormDialog';
import { MenuTable } from './MenuTable';
import { useSaveMenuItemWithImage } from './useSaveMenuItemWithImage';

const ALL = 'ALL';

export function MenuPage() {
  const client = useSupabase();
  const menu = useMenuItems(client);
  const categories = useMenuCategories(client);
  const setSoldOut = useSetSoldOut(client);
  const menuItemSaver = useSaveMenuItemWithImage();
  const archiveItem = useArchiveMenuItem(client);
  const saveCategories = useSaveCategories(client);
  const { notify } = useToast();
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [formTarget, setFormTarget] = useState<MenuItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const items = menu.data ?? [];
  const categoryList = categories.data ?? [];
  const visible = items.filter((item) => categoryId === ALL || item.categoryId === categoryId);
  const status =
    menu.status === 'success' ? toBoundaryStatus(categories.status) : toBoundaryStatus(menu.status);
  const retry = () => {
    void menu.refetch();
    void categories.refetch();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          icon={<Settings2 className="size-4" aria-hidden="true" />}
          disabled={categories.data === undefined}
          onClick={() => {
            saveCategories.reset();
            setIsCategoryOpen(true);
          }}
        >
          카테고리 관리
        </Button>
        <Button
          icon={<Plus className="size-4" aria-hidden="true" />}
          disabled={categories.data === undefined}
          onClick={() => setFormTarget('new')}
        >
          메뉴 추가
        </Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="메뉴 카테고리">
          <Card className="p-2">
            <ul className="flex gap-1 overflow-x-auto lg:flex-col">
              {[{ id: ALL, name: '전체', isActive: true }, ...categoryList].map((category) => {
                const count =
                  category.id === ALL
                    ? items.length
                    : items.filter((i) => i.categoryId === category.id).length;
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      aria-pressed={categoryId === category.id}
                      onClick={() => setCategoryId(category.id)}
                      className={cn(
                        'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-sm whitespace-nowrap',
                        categoryId === category.id
                          ? 'bg-secondary font-semibold text-secondary-foreground'
                          : 'hover:bg-background',
                      )}
                    >
                      <span>
                        {category.name}
                        {category.isActive ? '' : ' (비활성)'}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </nav>
        <Card>
          <QueryBoundary
            status={status}
            isEmpty={visible.length === 0}
            onRetry={retry}
            emptyTitle="이 카테고리에 메뉴가 없어요"
            emptyDescription="메뉴 추가 버튼으로 첫 메뉴를 등록해 보세요."
            emptyAction={<Button onClick={() => setFormTarget('new')}>메뉴 추가</Button>}
            loadingLabel="메뉴를 불러오는 중이에요"
          >
            <MenuTable
              items={visible}
              categories={categoryList}
              onEdit={setFormTarget}
              onDelete={setDeleting}
              onToggleSoldOut={(item, isSoldOut) =>
                setSoldOut.mutate(
                  { menuItemId: item.id, isSoldOut },
                  {
                    onSuccess: () =>
                      notify(`${item.name} ${isSoldOut ? '품절로 변경했어요' : '판매 재개했어요'}`),
                    onError: (error) => notify(describeError(error)),
                  },
                )
              }
            />
          </QueryBoundary>
        </Card>
      </div>

      <MenuFormDialog
        target={formTarget}
        categories={categoryList}
        isSaving={menuItemSaver.isSaving}
        onClose={() => setFormTarget(null)}
        onSave={(fields, existing, image) =>
          void menuItemSaver.save(fields, existing, image).then((isSaved) => {
            if (isSaved) setFormTarget(null);
          })
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ''} 메뉴를 삭제할까요?`}
        description="삭제하면 고객 메뉴와 관리 목록에서 사라져요. 지난 주문 내역은 그대로 유지돼요."
        confirmLabel="삭제"
        isDestructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (!target) return;
          archiveItem.mutate(target.id, {
            onSuccess: () => notify(`${target.name} 메뉴를 삭제했어요`),
            onError: (error) => notify(describeError(error)),
          });
        }}
      />
      <CategoryDialog
        open={isCategoryOpen}
        categories={categoryList}
        isSaving={saveCategories.isPending}
        errorMessage={saveCategories.isError ? describeError(saveCategories.error) : null}
        onClose={() => setIsCategoryOpen(false)}
        onSave={(draft) =>
          saveCategories.mutate(
            { draft, current: categoryList },
            {
              onSuccess: () => {
                setIsCategoryOpen(false);
                notify('카테고리를 저장했어요');
              },
            },
          )
        }
      />
    </div>
  );
}
