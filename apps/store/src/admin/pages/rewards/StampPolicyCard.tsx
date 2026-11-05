import { useSetStampPolicy, type StampPolicyView } from '@theolive/api';
import {
  MIN_AMOUNT_PER_STAMP,
  STAMPS_PER_ORDER_MAX,
  stampPolicySchema,
} from '@theolive/validation';
import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useSupabase } from '@/auth/AuthContext';
import { STAMP_EARN_MODE_LABEL } from '@/domain/labels';
import { STAMP_EARN_MODE, type StampEarnMode } from '@/domain/models';
import { describeError } from '@/lib/errorMessage';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { SelectField, TextField } from '@/ui/Fields';
import { useToast } from '@/ui/Toast';

const DEFAULT_AMOUNT_PER_STAMP = 5000;
const PER_ORDER_MESSAGE = `1~${STAMPS_PER_ORDER_MAX} 사이의 숫자로 입력해 주세요.`;
const PER_AMOUNT_MESSAGE = `${MIN_AMOUNT_PER_STAMP.toLocaleString('ko-KR')}원 이상의 숫자로 입력해 주세요.`;

function findMode(value: string, fallback: StampEarnMode): StampEarnMode {
  return Object.values(STAMP_EARN_MODE).find((mode) => mode === value) ?? fallback;
}

/** Earn timing is fixed at COMPLETED (OQ-24), so it is shown as text and never sent. */
export function StampPolicyCard({ policy }: { policy: StampPolicyView | null }) {
  const [mode, setMode] = useState<StampEarnMode>(policy?.earnMode ?? STAMP_EARN_MODE.PER_ORDER);
  const [perOrderText, setPerOrderText] = useState(String(policy?.stampsPerOrder ?? 1));
  const [amountText, setAmountText] = useState(
    String(policy?.amountPerStamp ?? DEFAULT_AMOUNT_PER_STAMP),
  );
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();
  const savePolicy = useSetStampPolicy(useSupabase());
  const isPerAmount = mode === STAMP_EARN_MODE.PER_AMOUNT;

  function save(): void {
    const parsed = stampPolicySchema.safeParse(
      isPerAmount
        ? { earnMode: mode, amountPerStamp: Number(amountText) }
        : { earnMode: mode, stampsPerOrder: Number(perOrderText) },
    );
    if (!parsed.success) {
      setError(isPerAmount ? PER_AMOUNT_MESSAGE : PER_ORDER_MESSAGE);
      return;
    }
    setError(null);
    savePolicy.mutate(parsed.data, {
      onSuccess: () => notify('스탬프 적립 정책을 저장했어요'),
      onError: (failure) => notify(describeError(failure)),
    });
  }

  return (
    <Card>
      <CardHeader icon={<ScrollText className="size-5" />} title="스탬프 적립 정책" />
      <CardBody>
        <p className="mb-4 text-sm text-muted-foreground">
          변경 이력은 서버에 기록되고 이후 결제된 주문부터 적용돼요. 적립은 주문이 수령 완료될 때 한
          번만 이뤄지고, 취소·거절된 주문은 적립되지 않아요.
        </p>
        <form
          className="grid gap-4 md:grid-cols-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <SelectField
            label="적립 기준"
            value={mode}
            onChange={(e) => setMode(findMode(e.target.value, mode))}
          >
            {Object.values(STAMP_EARN_MODE).map((m) => (
              <option key={m} value={m}>
                {STAMP_EARN_MODE_LABEL[m]}
              </option>
            ))}
          </SelectField>
          {isPerAmount ? (
            <TextField
              label="스탬프 1개당 금액 (원)"
              inputMode="numeric"
              value={amountText}
              error={error}
              onChange={(e) => setAmountText(e.target.value)}
            />
          ) : (
            <TextField
              label="주문 1건당 스탬프 (개)"
              inputMode="numeric"
              value={perOrderText}
              error={error}
              onChange={(e) => setPerOrderText(e.target.value)}
            />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">적립 시점</p>
            <p className="rounded-xl bg-secondary px-4 py-3 text-sm">수령 완료 시 (고정)</p>
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={savePolicy.isPending}>
              정책 저장
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
