import { type SaveCategoryInput } from '@theolive/api';
import { CATEGORY_NAME_MAX_LENGTH } from '@theolive/validation';
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button, BUTTON_VARIANT, IconButton } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Switch } from '@/ui/Switch';
import type { MenuCategory } from '@/domain/models';

/** A draft row: `id` is null until the category exists on the server; `key` keeps React rows stable. */
type DraftCategory = SaveCategoryInput & { key: string };

type CategoryDialogProps = {
  open: boolean;
  categories: MenuCategory[];
  isSaving: boolean;
  /** Message from the last failed save, shown inside the dialog so the draft is not lost. */
  errorMessage: string | null;
  onClose: () => void;
  onSave: (draft: SaveCategoryInput[]) => void;
};

function CategoryEditor({
  categories,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: Omit<CategoryDialogProps, 'open'>) {
  const [draft, setDraft] = useState<DraftCategory[]>(() =>
    categories.map((c) => ({ key: c.id, id: c.id, name: c.name, isActive: c.isActive })),
  );
  const [newName, setNewName] = useState('');
  const newKeyCounter = useRef(0);

  const update = (key: string, patch: Partial<DraftCategory>) =>
    setDraft((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
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
    newKeyCounter.current += 1;
    const key = `new-${newKeyCounter.current}`;
    setDraft((list) => [...list, { key, id: null, name, isActive: true }]);
    setNewName('');
  };
  const trimmed = draft.map((c) => c.name.trim());
  const hasBlankName = trimmed.some((name) => name === '');
  const hasDuplicate = new Set(trimmed).size !== trimmed.length;

  return (
    <Dialog
      open
      onClose={onClose}
      title="카테고리 관리"
      description="이름 변경, 순서 정렬, 비활성화를 할 수 있어요. 카테고리는 삭제할 수 없고, 비활성화하면 고객 메뉴에서 숨겨져요."
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={hasBlankName || hasDuplicate || isSaving}
            onClick={() =>
              onSave(draft.map(({ id, name, isActive }) => ({ id, name: name.trim(), isActive })))
            }
          >
            저장
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2">
        {draft.map((category, index) => (
          <li
            key={category.key}
            className="flex items-center gap-1 rounded-xl border border-border pl-3"
          >
            <input
              aria-label={`카테고리 이름: ${category.name}`}
              value={category.name}
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              onChange={(e) => update(category.key, { name: e.target.value })}
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
              onChange={(isActive) => update(category.key, { isActive })}
              label={`${category.name} 활성화`}
            />
          </li>
        ))}
      </ul>
      {hasDuplicate ? (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          같은 이름의 카테고리가 있어요.
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}
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
          maxLength={CATEGORY_NAME_MAX_LENGTH}
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
