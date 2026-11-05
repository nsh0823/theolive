import { useState } from 'react';
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { deleteExchangeRule, nextId, saveExchangeRule } from '@/data/actions';
import { useExchangeRulesQuery } from '@/data/queries';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { Button, IconButton } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import type { StampExchangeRule } from '@/domain/models';
import { ExchangeRuleDialog } from './ExchangeRuleDialog';

export function ExchangeRulesCard() {
  const rules = useExchangeRulesQuery();
  const { notify } = useToast();
  const [target, setTarget] = useState<StampExchangeRule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<StampExchangeRule | null>(null);

  return (
    <Card>
      <CardHeader
        icon={<Repeat className="size-5" />}
        title="쿠폰 교환 규칙"
        action={
          <Button
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setTarget('new')}
          >
            규칙 추가
          </Button>
        }
      />
      <QueryBoundary
        status={rules.status}
        isEmpty={rules.data.length === 0}
        onRetry={rules.refetch}
        emptyTitle="교환 규칙이 없어요"
        emptyDescription="스탬프를 쿠폰으로 바꿔줄 규칙을 추가해 보세요."
      >
        <DataTable caption="스탬프 쿠폰 교환 규칙">
          <thead>
            <tr>
              <Th>필요 스탬프</Th>
              <Th>교환 쿠폰</Th>
              <Th>유효기간</Th>
              <Th>상태</Th>
              <Th>
                <span className="sr-only">관리</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rules.data.map((rule) => (
              <Tr key={rule.id}>
                <Td className="text-base font-bold tabular-nums">{rule.requiredStamps}개</Td>
                <Td>{rule.couponTitle}</Td>
                <Td className="tabular-nums">{rule.validDays}일</Td>
                <Td>
                  <Badge tone={rule.isActive ? BADGE_TONE.PRIMARY : BADGE_TONE.NEUTRAL}>
                    {rule.isActive ? '교환 가능' : '중지'}
                  </Badge>
                </Td>
                <Td>
                  <span className="flex">
                    <IconButton
                      label={`${rule.requiredStamps}개 교환 규칙 수정`}
                      className="size-11"
                      onClick={() => setTarget(rule)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`${rule.requiredStamps}개 교환 규칙 삭제`}
                      className="size-11"
                      onClick={() => setDeleting(rule)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </IconButton>
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </QueryBoundary>
      <ExchangeRuleDialog
        target={target}
        onClose={() => setTarget(null)}
        onSave={(values, existing) => {
          saveExchangeRule({ ...values, id: existing?.id ?? nextId('rule') });
          notify('교환 규칙을 저장했어요');
          setTarget(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="교환 규칙을 삭제할까요?"
        description="이미 발급된 쿠폰에는 영향이 없고, 이후 교환만 막혀요."
        confirmLabel="삭제"
        isDestructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteExchangeRule(deleting.id);
          setDeleting(null);
          notify('교환 규칙을 삭제했어요');
        }}
      />
    </Card>
  );
}
