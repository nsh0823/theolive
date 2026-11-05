import {
  useCouponRules,
  useSaveCouponRule,
  useSetCouponRuleActive,
  type CouponRuleView,
} from '@theolive/api';
import { useState } from 'react';
import { Pencil, Plus, Power, Repeat } from 'lucide-react';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { describeError } from '@/lib/errorMessage';
import { formatWon } from '@/lib/format';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { Button, IconButton } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { DataTable, Td, Th, Tr } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import { ExchangeRuleDialog, type RuleTarget } from './ExchangeRuleDialog';

function benefitText(rule: CouponRuleView): string {
  if (rule.benefitType === 'FIXED_AMOUNT') return `${formatWon(rule.discountAmount ?? 0)} 할인`;
  return rule.discountAmount ? `1개 무료 (최대 ${formatWon(rule.discountAmount)})` : '1개 무료';
}

export function ExchangeRulesCard() {
  const client = useSupabase();
  const rules = useCouponRules(client);
  const saveRule = useSaveCouponRule(client);
  const setActive = useSetCouponRuleActive(client);
  const { notify } = useToast();
  const [target, setTarget] = useState<RuleTarget | null>(null);
  const list = rules.data ?? [];

  function toggle(rule: CouponRuleView): void {
    setActive.mutate(
      { id: rule.id, isActive: !rule.isActive },
      {
        onSuccess: () =>
          notify(rule.isActive ? '교환 규칙을 중지했어요' : '교환 규칙을 다시 켰어요'),
        onError: (failure) => notify(describeError(failure)),
      },
    );
  }

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
        status={toBoundaryStatus(rules.status)}
        isEmpty={list.length === 0}
        onRetry={() => void rules.refetch()}
        emptyTitle="교환 규칙이 없어요"
        emptyDescription="스탬프를 쿠폰으로 바꿔줄 규칙을 추가해 보세요."
      >
        <DataTable caption="스탬프 쿠폰 교환 규칙">
          <thead>
            <tr>
              <Th>필요 스탬프</Th>
              <Th>교환 쿠폰</Th>
              <Th>혜택</Th>
              <Th>유효기간</Th>
              <Th>상태</Th>
              <Th>
                <span className="sr-only">관리</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {list.map((rule) => (
              <Tr key={rule.id}>
                <Td className="text-base font-bold tabular-nums">{rule.requiredStamps}개</Td>
                <Td>{rule.title}</Td>
                <Td>{benefitText(rule)}</Td>
                <Td className="tabular-nums">{rule.validDays}일</Td>
                <Td>
                  <Badge tone={rule.isActive ? BADGE_TONE.PRIMARY : BADGE_TONE.NEUTRAL}>
                    {rule.isActive ? '교환 가능' : '중지'}
                  </Badge>
                </Td>
                <Td>
                  <span className="flex">
                    <IconButton
                      label={`${rule.title} 수정`}
                      className="size-11"
                      onClick={() => setTarget(rule)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`${rule.title} ${rule.isActive ? '중지' : '다시 켜기'}`}
                      className="size-11"
                      onClick={() => toggle(rule)}
                    >
                      <Power className="size-4" aria-hidden="true" />
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
        isSaving={saveRule.isPending}
        onClose={() => setTarget(null)}
        onSave={(values, existing) => {
          saveRule.mutate(
            { ...values, id: existing?.id ?? null },
            {
              onSuccess: () => {
                notify('교환 규칙을 저장했어요');
                setTarget(null);
              },
              onError: (failure) => notify(describeError(failure)),
            },
          );
        }}
      />
    </Card>
  );
}
