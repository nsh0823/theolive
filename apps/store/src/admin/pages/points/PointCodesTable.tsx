import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { POINT_CODE_STATUS_LABEL } from '@/domain/labels';
import { POINT_CODE_STATUS, type PointCode, type PointCodeStatus } from '@/domain/models';
import { Badge, BADGE_TONE, type BadgeTone } from '@/ui/Badge';
import { Card, CardHeader } from '@/ui/Card';
import { SelectField } from '@/ui/Fields';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { formatDate, formatWon } from '@/lib/format';
import type { QueryStatus } from '@/data/useFixtureQuery';

const TONE: Record<PointCodeStatus, BadgeTone> = {
  [POINT_CODE_STATUS.UNUSED]: BADGE_TONE.NEUTRAL,
  [POINT_CODE_STATUS.REGISTERED]: BADGE_TONE.SAGE,
  [POINT_CODE_STATUS.EXHAUSTED]: BADGE_TONE.NEUTRAL,
  [POINT_CODE_STATUS.EXPIRED]: BADGE_TONE.DANGER,
};
const ALL = 'ALL';

type Props = { status: QueryStatus; codes: PointCode[]; onRetry: () => void };

export function PointCodesTable({ status, codes, onRetry }: Props) {
  const [filter, setFilter] = useState<PointCodeStatus | typeof ALL>(ALL);
  const statuses = Object.values(POINT_CODE_STATUS);
  const rows = codes.filter((code) => filter === ALL || code.status === filter);
  return (
    <Card>
      <CardHeader
        icon={<ListChecks className="size-5" />}
        title="발급 내역"
        action={
          <div className="w-40">
            <SelectField
              label="상태 필터"
              value={filter}
              onChange={(e) => setFilter(statuses.find((s) => s === e.target.value) ?? ALL)}
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
            </tr>
          </thead>
          <tbody>
            {rows.map((code) => (
              <Tr key={code.id}>
                <Td className="font-mono text-xs font-semibold">{code.code}</Td>
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
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </QueryBoundary>
    </Card>
  );
}
