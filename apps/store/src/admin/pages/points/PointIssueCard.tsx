import { useIssuePointCodes, type IssuedPointCode } from '@theolive/api';
import {
  pointIssueSchema,
  POINT_AMOUNT_MAX,
  POINT_AMOUNT_MIN,
  POINT_MEMO_MAX_LENGTH,
  POINT_QUANTITY_MAX,
} from '@theolive/validation';
import { CirclePlus, Copy } from 'lucide-react';
import { useState } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import { describeError } from '@/lib/errorMessage';
import { toDateInputValue } from '@/lib/format';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Fields';
import { useToast } from '@/ui/Toast';

type FieldKey = 'amount' | 'quantity' | 'expiresOn' | 'memo';
const FIELDS: { key: FieldKey; message: string }[] = [
  {
    key: 'amount',
    message: `${POINT_AMOUNT_MIN.toLocaleString('ko-KR')}원 이상 ${POINT_AMOUNT_MAX.toLocaleString('ko-KR')}원 이하로 입력해 주세요.`,
  },
  { key: 'quantity', message: `1~${POINT_QUANTITY_MAX}개 사이로 입력해 주세요.` },
  { key: 'expiresOn', message: '오늘 이후 날짜를 선택해 주세요.' },
  { key: 'memo', message: `메모는 ${POINT_MEMO_MAX_LENGTH}자 이내로 입력해 주세요.` },
];

function parseWhole(text: string): number {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** The only place full codes are readable: after this dialog closes the list shows them masked. */
function IssuedCodesDialog({
  codes,
  onClose,
}: {
  codes: IssuedPointCode[] | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const text = (codes ?? []).map((c) => c.code).join('\n');
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      notify('코드를 복사했어요');
    } catch (error) {
      console.error('Copying issued point codes failed', error);
      notify('복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.');
    }
  }
  return (
    <Dialog
      open={codes !== null}
      onClose={onClose}
      title="발급된 코드"
      description="이 창을 닫으면 코드 전체를 다시 볼 수 없어요. 지금 복사해서 보관해 주세요."
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={() => void copy()}>
            <Copy className="size-4" aria-hidden="true" />
            모두 복사
          </Button>
          <Button onClick={onClose}>닫기</Button>
        </>
      }
    >
      <ul aria-label="발급된 코드 목록" className="flex max-h-72 flex-col gap-1 overflow-auto">
        {(codes ?? []).map((c) => (
          <li key={c.id} className="rounded-lg bg-cream px-3 py-2 font-mono text-sm font-semibold">
            {c.code}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function PointIssueCard() {
  const [amount, setAmount] = useState('5000');
  const [quantity, setQuantity] = useState('1');
  const [expiresOn, setExpiresOn] = useState('');
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [issued, setIssued] = useState<IssuedPointCode[] | null>(null);
  const issue = useIssuePointCodes(useSupabase());
  const { notify } = useToast();

  function submit(): void {
    const parsed = pointIssueSchema.safeParse({
      amount: parseWhole(amount),
      quantity: parseWhole(quantity),
      expiresOn,
      memo,
    });
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        const field = FIELDS.find((candidate) => candidate.key === problem.path[0]);
        if (field) nextErrors[field.key] = field.message;
      }
    } else if (parsed.data.expiresOn <= toDateInputValue(new Date().toISOString())) {
      // The server checks this against its own (KST) date; this only saves a round trip.
      nextErrors.expiresOn = '오늘 이후 날짜를 선택해 주세요.';
    }
    setErrors(nextErrors);
    if (!parsed.success || Object.keys(nextErrors).length > 0) return;
    issue.mutate(parsed.data, {
      onSuccess: (codes) => {
        setIssued(codes);
        setMemo('');
        notify(`쿠폰 포인트 코드 ${codes.length}개를 발급했어요`);
      },
      onError: (failure) => notify(describeError(failure)),
    });
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
            코드는 서버에서 만들어요. 발급 직후 한 번만 전체를 볼 수 있고, 만료일 당일까지 쓸 수
            있어요. 등록된 코드는 무효로 바꿀 수 없어요.
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={issue.isPending}>
              코드 발급
            </Button>
          </div>
        </form>
      </CardBody>
      <IssuedCodesDialog codes={issued} onClose={() => setIssued(null)} />
    </Card>
  );
}
