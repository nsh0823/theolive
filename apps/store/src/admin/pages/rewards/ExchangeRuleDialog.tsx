import type { CouponRuleView } from '@theolive/api';
import {
  COUPON_DISCOUNT_MAX,
  COUPON_REQUIRED_STAMPS_MAX,
  COUPON_TITLE_MAX_LENGTH,
  COUPON_VALID_DAYS_MAX,
  exchangeRuleSchema,
  type ExchangeRuleInput,
} from '@theolive/validation';
import { useState } from 'react';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Fields';

export type RuleTarget = CouponRuleView | 'new';

type Props = {
  target: RuleTarget | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: ExchangeRuleInput, existing: CouponRuleView | null) => void;
};

type Field = 'title' | 'requiredStamps' | 'validDays' | 'discountAmount';
type Errors = Partial<Record<Field, string>>;

const DEFAULT_VALID_DAYS = 90;
const FIELD_MESSAGE: Record<Field, string> = {
  title: `쿠폰 이름을 ${COUPON_TITLE_MAX_LENGTH}자 이내로 입력해 주세요.`,
  requiredStamps: `1~${COUPON_REQUIRED_STAMPS_MAX} 사이의 숫자로 입력해 주세요.`,
  validDays: `1~${COUPON_VALID_DAYS_MAX}일 사이로 입력해 주세요.`,
  discountAmount: `1~${COUPON_DISCOUNT_MAX.toLocaleString('ko-KR')}원 사이로 입력해 주세요.`,
};

function isField(value: unknown): value is Field {
  return typeof value === 'string' && value in FIELD_MESSAGE;
}

function Form({ target, isSaving, onClose, onSave }: Props & { target: RuleTarget }) {
  const existing = target === 'new' ? null : target;
  // Editing keeps the benefit type and eligible items; new rules give one free item up to the cap.
  const benefitType = existing?.benefitType ?? 'FREE_ITEM';
  const isFixed = benefitType === 'FIXED_AMOUNT';
  const [required, setRequired] = useState(existing ? String(existing.requiredStamps) : '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [days, setDays] = useState(String(existing?.validDays ?? DEFAULT_VALID_DAYS));
  const [cap, setCap] = useState(existing?.discountAmount ? String(existing.discountAmount) : '');
  const [errors, setErrors] = useState<Errors>({});

  function submit(): void {
    const parsed = exchangeRuleSchema.safeParse({
      title,
      requiredStamps: Number(required),
      validDays: Number(days),
      benefitType,
      discountAmount: cap.trim() === '' ? null : Number(cap),
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (isField(field)) next[field] = FIELD_MESSAGE[field];
      }
      setErrors(next);
      return;
    }
    onSave(parsed.data, existing);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? '교환 규칙 수정' : '교환 규칙 추가'}
      description="올리브 스탬프를 쿠폰으로 교환하는 조건이에요. 이미 발급된 쿠폰은 바뀌지 않아요."
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit} disabled={isSaving}>
            저장
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          label="필요한 스탬프 (개)"
          data-autofocus
          inputMode="numeric"
          value={required}
          error={errors.requiredStamps}
          onChange={(e) => setRequired(e.target.value)}
        />
        <TextField
          label="교환 쿠폰 이름"
          maxLength={COUPON_TITLE_MAX_LENGTH}
          value={title}
          error={errors.title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextField
          label="유효기간 (일)"
          inputMode="numeric"
          value={days}
          error={errors.validDays}
          onChange={(e) => setDays(e.target.value)}
        />
        <TextField
          label={isFixed ? '할인 금액 (원)' : '최대 할인 금액 (원, 선택)'}
          inputMode="numeric"
          value={cap}
          error={errors.discountAmount}
          hint={
            isFixed
              ? '주문 금액에서 이 금액만큼 빼요.'
              : '비워 두면 가장 비싼 해당 메뉴 1개 값만큼 무료예요. 입력하면 그 금액까지만 무료예요.'
          }
          onChange={(e) => setCap(e.target.value)}
        />
      </form>
    </Dialog>
  );
}

export function ExchangeRuleDialog(props: Props) {
  if (props.target === null) return null;
  return (
    <Form key={props.target === 'new' ? 'new' : props.target.id} {...props} target={props.target} />
  );
}
