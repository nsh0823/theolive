import { Text } from '@theolive/ui/components/text';
import { useState } from 'react';

import { useCancelOrderMutation } from '@/hooks/useOrders';
import { userMessage } from '@/lib/errorMessage';
import { ORDER_STATUS, type Order } from '@/models';

import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CtaButton } from '../ui/CtaButton';

/**
 * 주문 취소 (OQ-8): offered only while the order is PAID, before staff accept it; a paid order is refunded
 * automatically. If the status moved on meanwhile the server answers and the order is refetched.
 */
export function CancelOrderControl({ order }: { order: Order }) {
  const cancel = useCancelOrderMutation();
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.status !== ORDER_STATUS.PAID) return null;

  const confirmCancel = async () => {
    if (cancel.isPending) return;
    setIsAsking(false);
    try {
      await cancel.mutateAsync({ orderId: order.id, expectedStatus: ORDER_STATUS.PAID });
      setError(null);
    } catch (cause) {
      console.error('order: cancel failed', cause);
      setError(userMessage(cause));
    }
  };

  return (
    <>
      {error ? (
        <Text className="text-center text-destructive" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <CtaButton
        label="주문 취소"
        variant="outline"
        isLoading={cancel.isPending}
        onPress={() => setIsAsking(true)}
      />
      <ConfirmDialog
        visible={isAsking}
        title="주문을 취소할까요?"
        message="아직 매장에서 접수하기 전이라 취소할 수 있어요. 결제한 금액은 자동으로 환불돼요."
        confirmLabel="주문 취소"
        cancelLabel="닫기"
        destructive
        onCancel={() => setIsAsking(false)}
        onConfirm={() => void confirmCancel()}
      />
    </>
  );
}
