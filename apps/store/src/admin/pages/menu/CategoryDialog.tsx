import { useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button, BUTTON_VARIANT, IconButton } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Switch } from '@/ui/Switch';
import { nextId } from '@/data/actions';
import type { MenuCategory, MenuItem } from '@/domain/models';

const CATEGORY_NAME_MAX = 20;

type CategoryDialogProps = {
  open: boolean;
  categories: MenuCategory[];
  menu: MenuItem[];
  onClose: () => void;
  onSave: (categories: MenuCategory[]) => void;
};

function CategoryEditor({ categories, menu, onClose, onSave }: Omit<CategoryDialogProps, 'open'>) {
  const [draft, setDraft] = useState<MenuCategory[]>(categories);
  const [newName, setNewName] = useState('');

  const update = (id: string, patch: Partial<MenuCategory>) =>
    setDraft((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const move = (index: number, delta: number) =>
    setDraft((list) => {
      const target = index + delta;
      const a = list[index];
      const b = list[target];
      if (!a || !b) return list;
      const copy = [...list];
      copy[index] = b;
      copy[target] = a;
      return copy;
    });
  const add = () => {
    const name = newName.trim();
    if (name === '') return;
    setDraft((list) => [...list, { id: nextId('category'), name, isActive: true }]);
    setNewName('');
  };
  const hasItems = (id: string) => menu.some((item) => item.categoryId === id);
  const hasBlankName = draft.some((c) => c.name.trim() === '');

  return (
    <Dialog
      open
      onClose={onClose}
      title="카테고리 관리"
      description="이름 변경, 순서 정렬, 비활성화를 할 수 있어요. 메뉴가 있는 카테고리는 삭제할 수 없어요."
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={hasBlankName}
            onClick={() => onSave(draft.map((c) => ({ ...c, name: c.name.trim() })))}
          >
            저장
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2">
        {draft.map((category, index) => (
          <li
            key={category.id}
            className="flex items-center gap-1 rounded-xl border border-border pl-3"
          >
            <input
              aria-label={`카테고리 이름: ${category.name}`}
              value={category.name}
              maxLength={CATEGORY_NAME_MAX}
              onChange={(e) => update(category.id, { name: e.target.value })}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm font-medium"
            />
            <IconButton
              label={`${category.name} 위로 이동`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="size-11"
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label={`${category.name} 아래로 이동`}
              disabled={index === draft.length - 1}
              onClick={() => move(index, 1)}
              className="size-11"
            >
              <ArrowDown className="size-4" aria-hidden="true" />
            </IconButton>
            <span className="text-xs text-muted-foreground">
              {category.isActive ? '활성' : '비활성'}
            </span>
            <Switch
              checked={category.isActive}
              onChange={(isActive) => update(category.id, { isActive })}
              label={`${category.name} 활성화`}
            />
            <IconButton
              label={`${category.name} 삭제`}
              disabled={hasItems(category.id)}
              onClick={() => setDraft((list) => list.filter((c) => c.id !== category.id))}
              className="mr-1 size-11"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          aria-label="새 카테고리 이름"
          placeholder="새 카테고리 이름"
          value={newName}
          maxLength={CATEGORY_NAME_MAX}
          onChange={(e) => setNewName(e.target.value)}
          className="h-11 flex-1 rounded-xl border border-input px-3 text-sm"
        />
        <Button type="submit" variant={BUTTON_VARIANT.SECONDARY} disabled={newName.trim() === ''}>
          추가
        </Button>
      </form>
    </Dialog>
  );
}

export function CategoryDialog({ open, ...rest }: CategoryDialogProps) {
  return open ? <CategoryEditor {...rest} /> : null;
}
