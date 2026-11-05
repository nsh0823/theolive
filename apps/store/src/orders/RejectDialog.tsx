import { ORDER_REJECT_REASON, type OrderRejectReason } from '@theolive/types';
import {
  REJECT_REASON_MAX_LENGTH,
  rejectOrderSchema,
  type RejectOrderInput,
} from '@theolive/validation';
import { useState } from 'react';
import { Button, BUTTON_SIZE, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextAreaField } from '@/ui/Fields';
import { cn } from '@/lib/cn';
import { REJECT_REASON_LABEL } from '@/domain/labels';
import type { Order } from '@/domain/models';

const REJECT_REASONS = Object.values(ORDER_REJECT_REASON);

type RejectDialogProps = {
  order: Order | null;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: (rejection: RejectOrderInput) => void;
};

/** Reject needs a reason code (OQ-10); "기타" also needs written text. Validated with the shared schema. */
export function RejectDialog({ order, isBusy = false, onCancel, onConfirm }: RejectDialogProps) {
  const [reasonCode, setReasonCode] = useState<OrderRejectReason | null>(null);
  const [otherText, setOtherText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setReasonCode(null);
    setOtherText('');
    setError(null);
  }

  function handleConfirm(): void {
    if (reasonCode === null) {
      setError('거절 사유를 선택해 주세요.');
      return;
    }
    const parsed = rejectOrderSchema.safeParse({
      reasonCode,
      reason: reasonCode === ORDER_REJECT_REASON.OTHER ? otherText : '',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력한 내용을 확인해 주세요.');
      return;
    }
    onConfirm(parsed.data);
  }

  function handleCancel(): void {
    reset();
    onCancel();
  }

  return (
    <Dialog
      open={order !== null}
      onClose={handleCancel}
      title={order ? `${order.orderNumber} 주문을 거절할까요?` : '주문 거절'}
      description="거절하면 고객에게 사유가 안내되고 결제 금액이 자동으로 환불됩니다. 되돌릴 수 없어요."
      widthClass="max-w-md"
      footer={
        <>
          <Button size={BUTTON_SIZE.LG} variant={BUTTON_VARIANT.OUTLINE} onClick={handleCancel}>
            취소
          </Button>
          <Button
            size={BUTTON_SIZE.LG}
            variant={BUTTON_VARIANT.DANGER}
            disabled={isBusy}
            onClick={handleConfirm}
          >
            주문 거절
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">거절 사유</legend>
        {REJECT_REASONS.map((code) => (
          <label
            key={code}
            className={cn(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-base has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
              reasonCode === code ? 'border-primary bg-secondary font-semibold' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="reject-reason"
              value={code}
              checked={reasonCode === code}
              onChange={() => {
                setReasonCode(code);
                setError(null);
              }}
              className="size-5 accent-primary"
            />
            {REJECT_REASON_LABEL[code]}
          </label>
        ))}
      </fieldset>
      {reasonCode === ORDER_REJECT_REASON.OTHER ? (
        <TextAreaField
          label="기타 사유"
          value={otherText}
          maxLength={REJECT_REASON_MAX_LENGTH}
          onChange={(event) => setOtherText(event.target.value)}
          wrapperClassName="mt-4"
        />
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
