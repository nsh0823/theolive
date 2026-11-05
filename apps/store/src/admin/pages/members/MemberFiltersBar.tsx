import { RotateCcw } from 'lucide-react';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { SelectField, TextField } from '@/ui/Fields';
import { LOGIN_PROVIDER_LABEL } from '@/domain/labels';
import { LOGIN_PROVIDER } from '@/domain/memberModels';
import {
  EMPTY_MEMBER_FILTERS,
  MEMBER_FILTER_ALL,
  hasActiveMemberFilters,
  type MemberFilters,
} from '@/domain/members';

type Props = { filters: MemberFilters; onChange: (filters: MemberFilters) => void };

export function MemberFiltersBar({ filters, onChange }: Props) {
  const providers = Object.values(LOGIN_PROVIDER);
  return (
    <form
      role="search"
      aria-label="회원 검색 및 필터"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
      onSubmit={(e) => e.preventDefault()}
    >
      <TextField
        label="검색"
        type="search"
        placeholder="닉네임 또는 주문번호"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        wrapperClassName="xl:col-span-2"
      />
      <SelectField
        label="가입 경로"
        value={filters.provider}
        onChange={(e) =>
          onChange({
            ...filters,
            provider: providers.find((p) => p === e.target.value) ?? MEMBER_FILTER_ALL,
          })
        }
      >
        <option value={MEMBER_FILTER_ALL}>전체</option>
        {providers.map((p) => (
          <option key={p} value={p}>
            {LOGIN_PROVIDER_LABEL[p]}
          </option>
        ))}
      </SelectField>
      <TextField
        label="가입일 시작"
        type="date"
        value={filters.joinedFrom}
        max={filters.joinedTo || undefined}
        onChange={(e) => onChange({ ...filters, joinedFrom: e.target.value })}
      />
      <TextField
        label="가입일 종료"
        type="date"
        value={filters.joinedTo}
        min={filters.joinedFrom || undefined}
        onChange={(e) => onChange({ ...filters, joinedTo: e.target.value })}
      />
      <div className="flex items-end">
        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          disabled={!hasActiveMemberFilters(filters)}
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
          onClick={() => onChange(EMPTY_MEMBER_FILTERS)}
        >
          필터 초기화
        </Button>
      </div>
    </form>
  );
}
