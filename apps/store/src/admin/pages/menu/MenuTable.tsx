import { Pencil, Trash2 } from 'lucide-react';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { IconButton } from '@/ui/Button';
import { Switch } from '@/ui/Switch';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { Thumbnail } from '@/ui/Thumbnail';
import { TemperatureBadge } from '@/shared/badges';
import { formatWon } from '@/lib/format';
import type { MenuCategory, MenuItem } from '@/domain/models';

type MenuTableProps = {
  items: MenuItem[];
  categories: MenuCategory[];
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleSoldOut: (item: MenuItem, isSoldOut: boolean) => void;
};

function availability(item: MenuItem): {
  label: string;
  tone: (typeof BADGE_TONE)[keyof typeof BADGE_TONE];
} {
  if (!item.isActive) return { label: '판매 중지', tone: BADGE_TONE.NEUTRAL };
  if (item.isSoldOut) return { label: '품절', tone: BADGE_TONE.DANGER };
  return { label: '판매 중', tone: BADGE_TONE.SAGE };
}

export function MenuTable({
  items,
  categories,
  onEdit,
  onDelete,
  onToggleSoldOut,
}: MenuTableProps) {
  return (
    <DataTable caption="메뉴 목록">
      <thead>
        <tr>
          <Th>이미지</Th>
          <Th>메뉴</Th>
          <Th>카테고리</Th>
          <Th className="text-right">가격</Th>
          <Th>옵션</Th>
          <Th>판매 상태</Th>
          <Th>품절 처리</Th>
          <Th>
            <span className="sr-only">관리</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const state = availability(item);
          return (
            <Tr key={item.id}>
              <Td>
                <Thumbnail imageUrl={item.imageUrl} />
              </Td>
              <Td>
                <p className="font-semibold">{item.name}</p>
                <p className="max-w-36 truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              </Td>
              <Td>{categories.find((c) => c.id === item.categoryId)?.name ?? '-'}</Td>
              <Td className="text-right font-semibold whitespace-nowrap tabular-nums">
                {formatWon(item.price)}
              </Td>
              <Td>
                <span className="flex gap-1">
                  {item.temperatures.length === 0 ? (
                    <span className="text-xs text-muted-foreground">선택 없음</span>
                  ) : (
                    item.temperatures.map((t) => <TemperatureBadge key={t} temperature={t} />)
                  )}
                </span>
              </Td>
              <Td>
                <Badge tone={state.tone}>{state.label}</Badge>
              </Td>
              <Td>
                <Switch
                  checked={item.isSoldOut}
                  onChange={(value) => onToggleSoldOut(item, value)}
                  label={`품절 처리: ${item.name}`}
                  disabled={!item.isActive}
                />
              </Td>
              <Td>
                <span className="flex">
                  <IconButton
                    label={`${item.name} 수정`}
                    onClick={() => onEdit(item)}
                    className="size-11"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`${item.name} 삭제`}
                    onClick={() => onDelete(item)}
                    className="size-11"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </IconButton>
                </span>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
