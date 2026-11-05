import { usePointPolicy, useSavePointPolicy, type PointPolicyView } from '@theolive/api';
import { pointPolicySchema } from '@theolive/validation';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import { toBoundaryStatus } from '@/data/queryStatus';
import { describeError } from '@/lib/errorMessage';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { TextField } from '@/ui/Fields';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { useToast } from '@/ui/Toast';

type FieldKey = 'min' | 'unit' | 'cap';
const FIELDS: { key: FieldKey; path: string; message: string }[] = [
  { key: 'min', path: 'minUseAmount', message: '0 이상의 숫자로 입력해 주세요.' },
  { key: 'unit', path: 'useUnit', message: '1 이상의 숫자로 입력해 주세요.' },
  { key: 'cap', path: 'maxUsePerOrder', message: '비워 두거나 1 이상의 숫자로 입력해 주세요.' },
];

/** Whole-number field: blank is "no value" (`null`), digits are a number, anything else is NaN (invalid). */
function parseWhole(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function PolicyForm({ policy }: { policy: PointPolicyView }) {
  const [minText, setMinText] = useState(String(policy.minUseAmount));
  const [unitText, setUnitText] = useState(String(policy.useUnit));
  const [capText, setCapText] = useState(
    policy.maxUsePerOrder === null ? '' : String(policy.maxUsePerOrder),
  );
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const save = useSavePointPolicy(useSupabase());
  const { notify } = useToast();

  function submit(): void {
    const parsed = pointPolicySchema.safeParse({
      // A blank minimum or unit is invalid; only the cap may be blank.
      minUseAmount: parseWhole(minText) ?? Number.NaN,
      useUnit: parseWhole(unitText) ?? Number.NaN,
      maxUsePerOrder: parseWhole(capText),
    });
    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = FIELDS.find((candidate) => candidate.path === issue.path[0]);
        if (field) next[field.key] = field.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(parsed.data, {
      onSuccess: () => notify('쿠폰 포인트 사용 규칙을 저장했어요'),
      onError: (failure) => notify(describeError(failure)),
    });
  }

  return (
    <form
      className="grid gap-4 md:grid-cols-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField
        label="최소 사용 금액 (원)"
        inputMode="numeric"
        value={minText}
        error={errors.min}
        onChange={(e) => setMinText(e.target.value)}
      />
      <TextField
        label="사용 단위 (원)"
        inputMode="numeric"
        value={unitText}
        error={errors.unit}
        onChange={(e) => setUnitText(e.target.value)}
      />
      <TextField
        label="주문당 최대 사용 금액 (원)"
        hint="비워 두면 제한이 없어요"
        inputMode="numeric"
        value={capText}
        error={errors.cap}
        onChange={(e) => setCapText(e.target.value)}
      />
      <p className="text-xs text-muted-foreground md:col-span-3">
        코드 입력은 계정당 {policy.registrationAttemptWindowMinutes}분에{' '}
        {policy.registrationAttemptLimit}번까지 틀릴 수 있어요 (서버 고정). 규칙은 이후 주문부터
        적용돼요.
      </p>
      <div className="md:col-span-3">
        <Button type="submit" disabled={save.isPending}>
          규칙 저장
        </Button>
      </div>
    </form>
  );
}

/** OQ-30: the use rules the server applies to every order. Owner-only; the server rejects anyone else. */
export function PointPolicyCard() {
  const policy = usePointPolicy(useSupabase());
  return (
    <Card>
      <CardHeader icon={<SlidersHorizontal className="size-5" />} title="사용 규칙" />
      <CardBody>
        <QueryBoundary
          status={toBoundaryStatus(policy.status)}
          isEmpty={false}
          onRetry={() => void policy.refetch()}
          emptyTitle=""
          loadingLabel="사용 규칙을 불러오는 중이에요"
        >
          {policy.data ? (
            <PolicyForm
              key={`${policy.data.minUseAmount}-${policy.data.useUnit}-${policy.data.maxUsePerOrder ?? 'none'}`}
              policy={policy.data}
            />
          ) : null}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}
