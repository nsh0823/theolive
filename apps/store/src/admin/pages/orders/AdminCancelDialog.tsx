import { useAdminCancelOrder } from '@theolive/api';
import { REJECT_REASON_MAX_LENGTH } from '@theolive/validation';
import { useState } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import type { Order } from '@/domain/models';
import { describeError } from '@/lib/errorMessage';
import { Button, BUTTON_SIZE, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextAreaField } from '@/ui/Fields';
import { useToast } from '@/ui/Toast';

type AdminCancelDialogProps = { order: Order | null; onClose: () => void };

/** OQ-9: admins cancel a PAID or ACCEPTED order with a reason; the customer is refunded automatically. */
export function AdminCancelDialog({ order, onClose }: AdminCancelDialogProps) {
  const client = useSupabase();
  const cancel = useAdminCancelOrder(client);
  const { notify } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close(): void {
    setReason('');
    setError(null);
    onClose();
  }

  function confirm(): void {
    const trimmed = reason.trim();
    if (!order) return;
    if (trimmed === '') {
      setError('취소 사유를 입력해 주세요.');
      return;
    }
    cancel.mutate(
      { orderId: order.id, expectedStatus: order.status, reason: trimmed },
      {
        onSuccess: () => {
          notify(`${order.orderNumber} 주문을 취소하고 환불을 시작했어요`);
          close();
        },
        // STALE_STATUS and the like: show the server's plain-language message; the lists refetch themselves.
        onError: (failure) => setError(describeError(failure)),
      },
    );
  }

  return (
    <Dialog
      open={order !== null}
      onClose={close}
      title={order ? `${order.orderNumber} 주문 취소 / 환불` : '주문 취소 / 환불'}
      description="취소하면 결제 금액이 전액 자동 환불되고 고객에게 안내돼요. 되돌릴 수 없어요."
      widthClass="max-w-md"
      footer={
        <>
          <Button size={BUTTON_SIZE.LG} variant={BUTTON_VARIANT.OUTLINE} onClick={close}>
            닫기
          </Button>
          <Button
            size={BUTTON_SIZE.LG}
            variant={BUTTON_VARIANT.DANGER}
            disabled={cancel.isPending}
            onClick={confirm}
          >
            주문 취소 및 환불
          </Button>
        </>
      }
    >
      <TextAreaField
        label="취소 사유"
        value={reason}
        maxLength={REJECT_REASON_MAX_LENGTH}
        onChange={(event) => setReason(event.target.value)}
      />
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
