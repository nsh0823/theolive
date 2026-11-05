import { Power } from 'lucide-react';
import { setStoreStatus } from '@/data/actions';
import { useStoreStatus } from '@/data/queries';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

/** Operating status and order acceptance. Shares state with the Store Web quick controls. */
export function OperationCard() {
  const status = useStoreStatus();
  const { notify } = useToast();
  return (
    <Card>
      <CardHeader icon={<Power className="size-5" />} title="운영 상태 · 주문 접수" />
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl border border-border px-4">
          <div className="py-3">
            <p className="text-sm text-muted-foreground">영업 상태</p>
            <p className="font-bold">{status.isOpen ? '영업 중' : '영업 종료'}</p>
          </div>
          <Switch
            checked={status.isOpen}
            label={`영업 상태: ${status.isOpen ? '영업 중' : '영업 종료'}`}
            onChange={(isOpen) => {
              setStoreStatus({ isOpen });
              notify(isOpen ? '영업을 시작했어요' : '영업을 종료했어요');
            }}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-4">
          <div className="py-3">
            <p className="text-sm text-muted-foreground">주문 접수</p>
            <p className="font-bold">{status.isAcceptingOrders ? '접수 가능' : '일시 중지'}</p>
            <p className="text-xs text-muted-foreground">
              일시 중지하면 고객이 새 주문을 할 수 없어요.
            </p>
          </div>
          <Switch
            checked={status.isAcceptingOrders}
            label={`주문 접수: ${status.isAcceptingOrders ? '접수 가능' : '일시 중지'}`}
            onChange={(isAcceptingOrders) => {
              setStoreStatus({ isAcceptingOrders });
              notify(isAcceptingOrders ? '주문 접수를 재개했어요' : '주문 접수를 일시 중지했어요');
            }}
          />
        </div>
      </CardBody>
    </Card>
  );
}
