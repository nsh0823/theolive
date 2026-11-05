import { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import {
  deleteMenuItem,
  nextId,
  saveCategories,
  saveMenuItem,
  setItemSoldOut,
} from '@/data/actions';
import { useCategoriesQuery, useMenuQuery } from '@/data/queries';
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

const ALL = 'ALL';

export function MenuPage() {
  const menu = useMenuQuery();
  const categories = useCategoriesQuery();
  const { notify } = useToast();
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [formTarget, setFormTarget] = useState<MenuItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const visible = menu.data.filter((item) => categoryId === ALL || item.categoryId === categoryId);
  const status = menu.status === 'success' ? categories.status : menu.status;
  const retry = () => {
    menu.refetch();
    categories.refetch();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          icon={<Settings2 className="size-4" aria-hidden="true" />}
          onClick={() => setIsCategoryOpen(true)}
        >
          카테고리 관리
        </Button>
        <Button
          icon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() => setFormTarget('new')}
        >
          메뉴 추가
        </Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="메뉴 카테고리">
          <Card className="p-2">
            <ul className="flex gap-1 overflow-x-auto lg:flex-col">
              {[{ id: ALL, name: '전체', isActive: true }, ...categories.data].map((category) => {
                const count =
                  category.id === ALL
                    ? menu.data.length
                    : menu.data.filter((i) => i.categoryId === category.id).length;
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
              categories={categories.data}
              onEdit={setFormTarget}
              onDelete={setDeleting}
              onToggleSoldOut={(item, isSoldOut) => {
                setItemSoldOut(item.id, isSoldOut);
                notify(`${item.name} ${isSoldOut ? '품절로 변경했어요' : '판매 재개했어요'}`);
              }}
            />
          </QueryBoundary>
        </Card>
      </div>

      <MenuFormDialog
        target={formTarget}
        categories={categories.data}
        onClose={() => setFormTarget(null)}
        onSave={(fields, existing) => {
          saveMenuItem(
            existing
              ? { ...existing, ...fields }
              : { ...fields, id: nextId('menu'), isSoldOut: false },
          );
          notify(
            existing ? `${fields.name} 메뉴를 수정했어요` : `${fields.name} 메뉴를 추가했어요`,
          );
          setFormTarget(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ''} 메뉴를 삭제할까요?`}
        description="삭제한 메뉴는 복구할 수 없어요. 지난 주문 내역은 그대로 유지돼요."
        confirmLabel="삭제"
        isDestructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteMenuItem(deleting.id);
            notify(`${deleting.name} 메뉴를 삭제했어요`);
          }
          setDeleting(null);
        }}
      />
      <CategoryDialog
        open={isCategoryOpen}
        categories={categories.data}
        menu={menu.data}
        onClose={() => setIsCategoryOpen(false)}
        onSave={(list) => {
          saveCategories(list);
          setIsCategoryOpen(false);
          notify('카테고리를 저장했어요');
        }}
      />
    </div>
  );
}
