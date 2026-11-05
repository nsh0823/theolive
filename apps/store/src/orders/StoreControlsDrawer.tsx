import { useSetStoreStatus, useStoreStatus } from '@theolive/api';
import { Link } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { Dialog, DIALOG_PLACEMENT } from '@/ui/Dialog';
import { Switch } from '@/ui/Switch';
import { cn } from '@/lib/cn';
import { useSupabase } from '@/auth/AuthContext';
import { ROUTES } from '@/lib/routes';
import { toBoundaryStatus } from '@/data/queryStatus';
import { describeError } from '@/lib/errorMessage';
import { QueryBoundary } from '@/ui/QueryBoundary';
import { useToast } from '@/ui/Toast';
import { SoldOutList } from './SoldOutList';

export const CONTROLS_TAB = { STATUS: 'status', SOLD_OUT: 'sold-out' } as const;
export type ControlsTab = (typeof CONTROLS_TAB)[keyof typeof CONTROLS_TAB];

const TAB_LABEL: Record<ControlsTab, string> = { status: '운영 상태', 'sold-out': '품절 관리' };

type ToggleRowProps = {
  title: string;
  stateText: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
};

function ToggleRow({ title, stateText, hint, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-lg font-bold">{stateText}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        label={`${title}: ${stateText}`}
      />
    </div>
  );
}

/** Open / accepting switches. The server (MANAGE_OPERATIONS) is the boundary; the switch shows the refetched value. */
function StatusPanel() {
  const client = useSupabase();
  const status = useStoreStatus(client);
  const setStatus = useSetStoreStatus(client);
  const { notify } = useToast();

  function change(patch: { isOpen?: boolean; isAcceptingOrders?: boolean }, message: string): void {
    setStatus.mutate(patch, {
      onSuccess: () => notify(message),
      onError: (error) => notify(describeError(error)),
    });
  }

  return (
    <QueryBoundary
      status={toBoundaryStatus(status.status)}
      isEmpty={false}
      onRetry={() => void status.refetch()}
      emptyTitle=""
      loadingLabel="매장 상태를 불러오는 중이에요"
    >
      {status.data ? (
        <div className="flex flex-col gap-3">
          <ToggleRow
            title="영업 상태"
            stateText={status.data.isOpen ? '영업 중' : '영업 종료'}
            hint="영업 시간은 관리자 화면의 매장 설정에서 관리해요."
            checked={status.data.isOpen}
            disabled={setStatus.isPending}
            onChange={(isOpen) =>
              change({ isOpen }, isOpen ? '영업을 시작했어요' : '영업을 종료했어요')
            }
          />
          <ToggleRow
            title="주문 접수"
            stateText={status.data.isAcceptingOrders ? '접수 가능' : '일시 중지'}
            hint="일시 중지하면 고객이 새 주문을 할 수 없어요."
            checked={status.data.isAcceptingOrders}
            disabled={setStatus.isPending}
            onChange={(isAcceptingOrders) =>
              change(
                { isAcceptingOrders },
                isAcceptingOrders ? '주문 접수를 재개했어요' : '주문 접수를 일시 중지했어요',
              )
            }
          />
          <Link
            to={ROUTES.ADMIN}
            className="mt-2 inline-flex min-h-12 items-center gap-2 self-start rounded-full px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            관리자 화면 열기
          </Link>
        </div>
      ) : null}
    </QueryBoundary>
  );
}

type StoreControlsDrawerProps = {
  open: boolean;
  tab: ControlsTab;
  onTabChange: (tab: ControlsTab) => void;
  onClose: () => void;
};

/** Quick store controls without leaving the board (brief section 3). */
export function StoreControlsDrawer({ open, tab, onTabChange, onClose }: StoreControlsDrawerProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="빠른 매장 설정"
      placement={DIALOG_PLACEMENT.RIGHT}
      widthClass="max-w-md"
    >
      <div
        role="tablist"
        aria-label="빠른 설정 구역"
        className="mb-5 flex gap-1 rounded-full bg-background p-1"
      >
        {Object.values(CONTROLS_TAB).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            id={`controls-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`controls-panel-${value}`}
            onClick={() => onTabChange(value)}
            className={cn(
              'h-12 flex-1 rounded-full text-sm font-semibold',
              tab === value ? 'bg-card shadow-card' : 'text-muted-foreground',
            )}
          >
            {TAB_LABEL[value]}
          </button>
        ))}
      </div>

      {tab === CONTROLS_TAB.STATUS ? (
        <div role="tabpanel" id="controls-panel-status" aria-labelledby="controls-tab-status">
          <StatusPanel />
        </div>
      ) : (
        <div role="tabpanel" id="controls-panel-sold-out" aria-labelledby="controls-tab-sold-out">
          <SoldOutList />
        </div>
      )}
    </Dialog>
  );
}
