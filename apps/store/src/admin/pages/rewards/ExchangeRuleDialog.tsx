import { useState } from 'react';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Fields';
import { Switch } from '@/ui/Switch';
import {
  COUPON_TITLE_MAX_LENGTH,
  validateExchangeRule,
  type ExchangeRuleErrors,
} from '@/domain/exchangeRule';
import type { StampExchangeRule } from '@/domain/models';

type Props = {
  target: StampExchangeRule | 'new' | null;
  onClose: () => void;
  onSave: (
    values: { requiredStamps: number; couponTitle: string; validDays: number; isActive: boolean },
    existing: StampExchangeRule | null,
  ) => void;
};

const DEFAULT_VALID_DAYS = 90;

function Form({ target, onClose, onSave }: Props & { target: StampExchangeRule | 'new' }) {
  const existing = target === 'new' ? null : target;
  const [required, setRequired] = useState(existing ? String(existing.requiredStamps) : '');
  const [title, setTitle] = useState(existing?.couponTitle ?? '');
  const [days, setDays] = useState(String(existing?.validDays ?? DEFAULT_VALID_DAYS));
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [errors, setErrors] = useState<ExchangeRuleErrors>({});

  function submit(): void {
    const result = validateExchangeRule({
      requiredText: required,
      couponTitle: title,
      validDaysText: days,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSave(
      {
        requiredStamps: result.requiredStamps,
        couponTitle: result.couponTitle,
        validDays: result.validDays,
        isActive,
      },
      existing,
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? '교환 규칙 수정' : '교환 규칙 추가'}
      description="올리브 스탬프를 쿠폰으로 교환하는 조건이에요."
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>저장</Button>
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
          error={errors.required}
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
          hint="유효기간 정책은 확정 전이에요 (PRD 15-3)."
          onChange={(e) => setDays(e.target.value)}
        />
        <div className="flex items-center justify-between rounded-xl border border-border px-4">
          <p className="py-2 text-sm font-semibold">교환 가능</p>
          <Switch checked={isActive} onChange={setIsActive} label="교환 가능" />
        </div>
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
