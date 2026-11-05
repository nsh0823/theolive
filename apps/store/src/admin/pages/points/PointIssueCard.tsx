import { useState } from 'react';
import { CirclePlus } from 'lucide-react';
import { addPointCodes, nextId } from '@/data/actions';
import {
  generateFixtureCode,
  validatePointIssue,
  type PointIssueErrors,
} from '@/domain/pointCodes';
import { POINT_CODE_STATUS, type PointCode } from '@/domain/models';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { TextField } from '@/ui/Fields';
import { useToast } from '@/ui/Toast';
import { toDateInputValue } from '@/lib/format';

const FIXTURE_SEED_BASE = 4217;

export function PointIssueCard({ existingCount }: { existingCount: number }) {
  const [amount, setAmount] = useState('5000');
  const [quantity, setQuantity] = useState('1');
  const [expiresOn, setExpiresOn] = useState('');
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<PointIssueErrors>({});
  const { notify } = useToast();

  function submit(): void {
    const nowIso = new Date().toISOString();
    const result = validatePointIssue(
      { amountText: amount, quantityText: quantity, expiresOn, memo },
      toDateInputValue(nowIso),
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const codes: PointCode[] = Array.from({ length: result.quantity }, (_, index) => ({
      id: nextId('point'),
      code: generateFixtureCode(FIXTURE_SEED_BASE + existingCount * 31 + index),
      amount: result.amount,
      remaining: result.amount,
      status: POINT_CODE_STATUS.UNUSED,
      issuedAt: nowIso,
      expiresAt: `${result.expiresOn}T23:59:00`,
      registeredAt: null,
      memo: result.memo,
    }));
    addPointCodes(codes);
    notify(`쿠폰 포인트 코드 ${codes.length}개를 발급했어요`);
    setMemo('');
  }

  return (
    <Card>
      <CardHeader icon={<CirclePlus className="size-5" />} title="코드 발급" />
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextField
            label="포인트 금액 (원)"
            inputMode="numeric"
            value={amount}
            error={errors.amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TextField
            label="발급 개수"
            inputMode="numeric"
            value={quantity}
            error={errors.quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <TextField
            label="만료일"
            type="date"
            value={expiresOn}
            error={errors.expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
          <TextField
            label="메모 (선택)"
            value={memo}
            placeholder="예: 새가족 환영 선물"
            error={errors.memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            화면 확인용 코드예요. 실제 코드는 서버에서 생성하고, 만료·재발급 정책은 확정 후 적용돼요
            (PRD 15-6).
          </p>
          <div className="sm:col-span-2">
            <Button type="submit">코드 발급</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
