import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { setStampPolicy } from '@/data/actions';
import { STAMP_EARN_MODE_LABEL, STAMP_EARN_TIMING_LABEL } from '@/domain/labels';
import {
  STAMP_EARN_MODE,
  STAMP_EARN_TIMING,
  type StampEarnMode,
  type StampEarnTiming,
  type StampPolicy,
} from '@/domain/models';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { SelectField, TextField } from '@/ui/Fields';
import { useToast } from '@/ui/Toast';

const MIN_AMOUNT_PER_STAMP = 1000;

function findOption<T extends string>(value: string, options: readonly T[], fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

export function StampPolicyCard({ policy }: { policy: StampPolicy }) {
  const [draft, setDraft] = useState(policy);
  const [amountText, setAmountText] = useState(String(policy.amountPerStamp));
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();
  const modes = Object.values(STAMP_EARN_MODE);
  const timings = Object.values(STAMP_EARN_TIMING);

  function save(): void {
    const amount = Number(amountText);
    if (
      draft.earnMode === STAMP_EARN_MODE.PER_AMOUNT &&
      (!Number.isInteger(amount) || amount < MIN_AMOUNT_PER_STAMP)
    ) {
      setError(`${MIN_AMOUNT_PER_STAMP.toLocaleString('ko-KR')}원 이상의 숫자로 입력해 주세요.`);
      return;
    }
    setError(null);
    setStampPolicy({
      ...draft,
      amountPerStamp: Number.isInteger(amount) && amount > 0 ? amount : draft.amountPerStamp,
    });
    notify('스탬프 적립 정책을 저장했어요');
  }

  return (
    <Card>
      <CardHeader
        icon={<ScrollText className="size-5" />}
        title="스탬프 적립 정책"
        action={<Badge tone={BADGE_TONE.WARNING}>점주 확정 필요</Badge>}
      />
      <CardBody>
        <p className="mb-4 text-sm text-muted-foreground">
          적립 기준과 시점은 아직 확정되지 않았어요 (PRD 15-1, 15-2). 변경 이력은 서버에 기록되고
          이후 주문부터 적용돼요.
        </p>
        <form
          className="grid gap-4 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <SelectField
            label="적립 기준"
            value={draft.earnMode}
            onChange={(e) =>
              setDraft({
                ...draft,
                earnMode: findOption<StampEarnMode>(e.target.value, modes, draft.earnMode),
              })
            }
          >
            {modes.map((m) => (
              <option key={m} value={m}>
                {STAMP_EARN_MODE_LABEL[m]}
              </option>
            ))}
          </SelectField>
          <TextField
            label="스탬프 1개당 결제 금액 (원)"
            inputMode="numeric"
            value={amountText}
            disabled={draft.earnMode !== STAMP_EARN_MODE.PER_AMOUNT}
            error={error}
            hint="결제 금액 기준일 때만 사용해요."
            onChange={(e) => setAmountText(e.target.value)}
          />
          <SelectField
            label="적립 시점"
            value={draft.earnTiming}
            onChange={(e) =>
              setDraft({
                ...draft,
                earnTiming: findOption<StampEarnTiming>(e.target.value, timings, draft.earnTiming),
              })
            }
          >
            {timings.map((t) => (
              <option key={t} value={t}>
                {STAMP_EARN_TIMING_LABEL[t]}
              </option>
            ))}
          </SelectField>
          <div className="md:col-span-3">
            <Button type="submit">정책 저장</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
