import { Link } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { Dialog, DIALOG_PLACEMENT } from '@/ui/Dialog';
import { Switch } from '@/ui/Switch';
import { cn } from '@/lib/cn';
import { setConnected, setStoreStatus } from '@/data/actions';
import { useConnection } from '@/data/queries';
import { ROUTES } from '@/lib/routes';
import type { StoreStatus } from '@/domain/models';
import { SoldOutList } from './SoldOutList';

export const CONTROLS_TAB = { STATUS: 'status', SOLD_OUT: 'sold-out' } as const;
export type ControlsTab = (typeof CONTROLS_TAB)[keyof typeof CONTROLS_TAB];

const TAB_LABEL: Record<ControlsTab, string> = { status: '운영 상태', 'sold-out': '품절 관리' };

type ToggleRowProps = {
  title: string;
  stateText: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

function ToggleRow({ title, stateText, hint, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-lg font-bold">{stateText}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={`${title}: ${stateText}`} />
    </div>
  );
}

type StoreControlsDrawerProps = {
  open: boolean;
  tab: ControlsTab;
  onTabChange: (tab: ControlsTab) => void;
  status: StoreStatus;
  onClose: () => void;
};

/** Quick store controls without leaving the board (brief section 3). */
export function StoreControlsDrawer({
  open,
  tab,
  onTabChange,
  status,
  onClose,
}: StoreControlsDrawerProps) {
  const { isConnected } = useConnection();
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
        <div
          role="tabpanel"
          id="controls-panel-status"
          aria-labelledby="controls-tab-status"
          className="flex flex-col gap-3"
        >
          <ToggleRow
            title="영업 상태"
            stateText={status.isOpen ? '영업 중' : '영업 종료'}
            hint="영업 시간은 관리자 화면의 매장 설정에서 관리해요."
            checked={status.isOpen}
            onChange={(isOpen) => setStoreStatus({ isOpen })}
          />
          <ToggleRow
            title="주문 접수"
            stateText={status.isAcceptingOrders ? '접수 가능' : '일시 중지'}
            hint="일시 중지하면 고객이 새 주문을 할 수 없어요."
            checked={status.isAcceptingOrders}
            onChange={(isAcceptingOrders) => setStoreStatus({ isAcceptingOrders })}
          />
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground">
              화면 확인용 (fixture 전용)
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">실시간 연결 끊김 상태 보기</p>
              <Switch
                checked={!isConnected}
                onChange={(off) => setConnected(!off)}
                label="실시간 연결 끊김 시뮬레이션"
              />
            </div>
          </div>
          <Link
            to={ROUTES.ADMIN}
            className="mt-2 inline-flex min-h-12 items-center gap-2 self-start rounded-full px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            관리자 화면 열기
          </Link>
        </div>
      ) : (
        <div role="tabpanel" id="controls-panel-sold-out" aria-labelledby="controls-tab-sold-out">
          <SoldOutList />
        </div>
      )}
    </Dialog>
  );
}
