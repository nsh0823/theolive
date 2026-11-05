import { RotateCcw } from 'lucide-react';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { SelectField, TextField } from '@/ui/Fields';
import {
  FILTER_ALL,
  EMPTY_ORDER_FILTERS,
  hasActiveFilters,
  type OrderFilters,
} from '@/domain/orderFilters';
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, PAYMENT_STATUS_LABEL } from '@/domain/labels';
import { ORDER_STATUS, ORDER_TYPE, PAYMENT_STATUS } from '@/domain/models';

type OrderFiltersBarProps = { filters: OrderFilters; onChange: (filters: OrderFilters) => void };

/** The select values come from our own option lists, so the narrowing below never sees other strings. */
function pick<T extends string>(value: string, allowed: readonly T[]): T | typeof FILTER_ALL {
  return allowed.find((candidate) => candidate === value) ?? FILTER_ALL;
}

export function OrderFiltersBar({ filters, onChange }: OrderFiltersBarProps) {
  const statuses = Object.values(ORDER_STATUS);
  const payments = Object.values(PAYMENT_STATUS);
  const types = Object.values(ORDER_TYPE);
  return (
    <form
      role="search"
      aria-label="주문 검색 및 필터"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
      onSubmit={(e) => e.preventDefault()}
    >
      <TextField
        label="검색"
        type="search"
        placeholder="주문번호 또는 메뉴명"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        wrapperClassName="xl:col-span-2"
      />
      <TextField
        label="시작일"
        type="date"
        value={filters.dateFrom}
        max={filters.dateTo || undefined}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
      />
      <TextField
        label="종료일"
        type="date"
        value={filters.dateTo}
        min={filters.dateFrom || undefined}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
      />
      <SelectField
        label="주문 상태"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: pick(e.target.value, statuses) })}
      >
        <option value={FILTER_ALL}>전체</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABEL[s]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="결제 상태"
        value={filters.paymentStatus}
        onChange={(e) => onChange({ ...filters, paymentStatus: pick(e.target.value, payments) })}
      >
        <option value={FILTER_ALL}>전체</option>
        {payments.map((s) => (
          <option key={s} value={s}>
            {PAYMENT_STATUS_LABEL[s]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="주문 방식"
        value={filters.orderType}
        onChange={(e) => onChange({ ...filters, orderType: pick(e.target.value, types) })}
      >
        <option value={FILTER_ALL}>전체</option>
        {types.map((s) => (
          <option key={s} value={s}>
            {ORDER_TYPE_LABEL[s]}
          </option>
        ))}
      </SelectField>
      <div className="flex items-end">
        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          disabled={!hasActiveFilters(filters)}
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
          onClick={() => onChange(EMPTY_ORDER_FILTERS)}
        >
          필터 초기화
        </Button>
      </div>
    </form>
  );
}
