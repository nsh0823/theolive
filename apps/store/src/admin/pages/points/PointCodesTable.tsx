import {
  POINT_CODE_DISPLAY_STATUS,
  POINT_CODE_PAGE_SIZE,
  useVoidPointCode,
  type PointCodeDisplayStatus,
  type PointCodeFilters,
  type PointCodeListView,
  type PointCodeView,
} from '@theolive/api';
import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import { POINT_CODE_STATUS_LABEL } from '@/domain/labels';
import type { QueryStatus } from '@/data/queryStatus';
import { describeError } from '@/lib/errorMessage';
import { Badge, BADGE_TONE, type BadgeTone } from '@/ui/Badge';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { SelectField } from '@/ui/Fields';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import { formatDate, formatWon } from '@/lib/format';

const TONE: Record<PointCodeDisplayStatus, BadgeTone> = {
  [POINT_CODE_DISPLAY_STATUS.UNUSED]: BADGE_TONE.NEUTRAL,
  [POINT_CODE_DISPLAY_STATUS.REGISTERED]: BADGE_TONE.SAGE,
  [POINT_CODE_DISPLAY_STATUS.EXHAUSTED]: BADGE_TONE.NEUTRAL,
  [POINT_CODE_DISPLAY_STATUS.EXPIRED]: BADGE_TONE.DANGER,
  [POINT_CODE_DISPLAY_STATUS.VOID]: BADGE_TONE.DANGER,
};
const ALL = 'ALL';

type Props = {
  status: QueryStatus;
  list: PointCodeListView | null;
  filters: PointCodeFilters;
  onFilters: (filters: PointCodeFilters) => void;
  onRetry: () => void;
};

export function PointCodesTable({ status, list, filters, onFilters, onRetry }: Props) {
  const [voiding, setVoiding] = useState<PointCodeView | null>(null);
  const voidCode = useVoidPointCode(useSupabase());
  const { notify } = useToast();
  const statuses = Object.values(POINT_CODE_DISPLAY_STATUS);
  const rows = list?.codes ?? [];
  const total = list?.matching ?? 0;
  const hasPrevious = filters.offset > 0;
  const hasNext = filters.offset + rows.length < total;

  function confirmVoid(): void {
    if (!voiding) return;
    voidCode.mutate(voiding.id, {
      onSuccess: () => notify('코드를 무효로 바꿨어요'),
      onError: (failure) => notify(describeError(failure)),
      onSettled: () => setVoiding(null),
    });
  }

  return (
    <Card>
      <CardHeader
        icon={<ListChecks className="size-5" />}
        title="발급 내역"
        action={
          <div className="w-40">
            <SelectField
              label="상태 필터"
              value={filters.status ?? ALL}
              onChange={(e) =>
                onFilters({
                  ...filters,
                  offset: 0,
                  status: statuses.find((s) => s === e.target.value) ?? null,
                })
              }
            >
              <option value={ALL}>전체</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {POINT_CODE_STATUS_LABEL[s]}
                </option>
              ))}
            </SelectField>
          </div>
        }
      />
      <QueryBoundary
        status={status}
        isEmpty={rows.length === 0}
        onRetry={onRetry}
        emptyTitle="발급된 코드가 없어요"
        emptyDescription="코드 발급에서 첫 쿠폰 포인트 코드를 만들어 보세요."
        loadingLabel="발급 내역을 불러오는 중이에요"
      >
        <DataTable caption="쿠폰 포인트 코드 발급 내역">
          <thead>
            <tr>
              <Th>코드</Th>
              <Th className="text-right">포인트</Th>
              <Th className="text-right">남은 포인트</Th>
              <Th>상태</Th>
              <Th>발급일</Th>
              <Th>만료일</Th>
              <Th>메모</Th>
              <Th>관리</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((code) => (
              <Tr key={code.id}>
                <Td className="font-mono text-xs font-semibold">{code.maskedCode}</Td>
                <Td className="text-right tabular-nums">{formatWon(code.amount)}</Td>
                <Td className="text-right font-semibold tabular-nums">
                  {formatWon(code.remaining)}
                </Td>
                <Td>
                  <Badge tone={TONE[code.status]}>{POINT_CODE_STATUS_LABEL[code.status]}</Badge>
                </Td>
                <Td className="tabular-nums">{formatDate(code.issuedAt)}</Td>
                <Td className="tabular-nums">{formatDate(code.expiresAt)}</Td>
                <Td className="text-muted-foreground">{code.memo || '-'}</Td>
                <Td>
                  {code.status === POINT_CODE_DISPLAY_STATUS.UNUSED ? (
                    <Button
                      variant={BUTTON_VARIANT.OUTLINE}
                      onClick={() => setVoiding(code)}
                      aria-label={`${code.maskedCode} 무효로 바꾸기`}
                    >
                      무효
                    </Button>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
        {hasPrevious || hasNext ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <Button
              variant={BUTTON_VARIANT.OUTLINE}
              disabled={!hasPrevious}
              onClick={() =>
                onFilters({
                  ...filters,
                  offset: Math.max(0, filters.offset - POINT_CODE_PAGE_SIZE),
                })
              }
            >
              이전
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              {filters.offset + 1}–{filters.offset + rows.length} / {total}
            </span>
            <Button
              variant={BUTTON_VARIANT.OUTLINE}
              disabled={!hasNext}
              onClick={() =>
                onFilters({ ...filters, offset: filters.offset + POINT_CODE_PAGE_SIZE })
              }
            >
              다음
            </Button>
          </div>
        ) : null}
      </QueryBoundary>
      <ConfirmDialog
        open={voiding !== null}
        title="코드를 무효로 바꿀까요?"
        description="무효로 바꾼 코드는 등록할 수 없어요. 이미 등록된 코드는 무효로 바꿀 수 없어요."
        confirmLabel="무효로 바꾸기"
        isDestructive
        onConfirm={confirmVoid}
        onCancel={() => setVoiding(null)}
      />
    </Card>
  );
}
