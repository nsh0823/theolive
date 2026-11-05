import { useState } from 'react';
import { Button, BUTTON_SIZE, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextAreaField } from '@/ui/Fields';
import { cn } from '@/lib/cn';
import type { Order } from '@/domain/models';

const REASON_OTHER = 'OTHER';

// Reason list is a proposal: PRD 15-8 leaves the rejection reasons and refund handling open.
export const REJECT_REASONS = [
  { id: 'OUT_OF_STOCK', label: '재고 부족 (품절)' },
  { id: 'CLOSED', label: '영업 종료' },
  { id: 'BUSY', label: '매장 사정 (혼잡)' },
  { id: REASON_OTHER, label: '기타 (직접 입력)' },
] as const;

type RejectDialogProps = {
  order: Order | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function RejectDialog({ order, onCancel, onConfirm }: RejectDialogProps) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setReasonId(null);
    setOtherText('');
    setError(null);
  }

  function handleConfirm(): void {
    const selected = REJECT_REASONS.find((reason) => reason.id === reasonId);
    if (!selected) {
      setError('거절 사유를 선택해 주세요.');
      return;
    }
    const finalReason = selected.id === REASON_OTHER ? otherText.trim() : selected.label;
    if (finalReason === '') {
      setError('기타 사유를 입력해 주세요.');
      return;
    }
    onConfirm(finalReason);
    reset();
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
      description="거절하면 고객에게 사유가 안내되고 결제 취소·환불 절차가 진행됩니다. 되돌릴 수 없어요."
      widthClass="max-w-md"
      footer={
        <>
          <Button size={BUTTON_SIZE.LG} variant={BUTTON_VARIANT.OUTLINE} onClick={handleCancel}>
            취소
          </Button>
          <Button size={BUTTON_SIZE.LG} variant={BUTTON_VARIANT.DANGER} onClick={handleConfirm}>
            주문 거절
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">거절 사유</legend>
        {REJECT_REASONS.map((reason) => (
          <label
            key={reason.id}
            className={cn(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-base has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
              reasonId === reason.id
                ? 'border-primary bg-secondary font-semibold'
                : 'border-border',
            )}
          >
            <input
              type="radio"
              name="reject-reason"
              value={reason.id}
              checked={reasonId === reason.id}
              onChange={() => {
                setReasonId(reason.id);
                setError(null);
              }}
              className="size-5 accent-primary"
            />
            {reason.label}
          </label>
        ))}
      </fieldset>
      {reasonId === REASON_OTHER ? (
        <TextAreaField
          label="기타 사유"
          value={otherText}
          maxLength={100}
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
