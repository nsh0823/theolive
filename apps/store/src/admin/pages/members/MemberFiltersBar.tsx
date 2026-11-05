import { RotateCcw } from 'lucide-react';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { TextField } from '@/ui/Fields';

type Props = { value: string; onChange: (value: string) => void };

/** The server searches nickname or order number only (never email or phone), so that is all this offers. */
export function MemberFiltersBar({ value, onChange }: Props) {
  return (
    <form
      role="search"
      aria-label="회원 검색"
      className="grid gap-3 sm:grid-cols-[1fr_auto]"
      onSubmit={(e) => e.preventDefault()}
    >
      <TextField
        label="검색"
        type="search"
        placeholder="닉네임 또는 주문번호"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-end">
        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          disabled={value === ''}
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
          onClick={() => onChange('')}
        >
          검색 초기화
        </Button>
      </div>
    </form>
  );
}
