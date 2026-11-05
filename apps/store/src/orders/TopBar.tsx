import { Bell, PackageX, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { Logo } from '@/ui/Logo';
import { Badge, BADGE_TONE } from '@/ui/Badge';
import { cn } from '@/lib/cn';
import { Button, BUTTON_SIZE, BUTTON_VARIANT } from '@/ui/Button';
import type { StoreStatus } from '@/domain/models';

/** `null` while the status is loading or failed to load: never show a state we cannot trust. */
export function describeStoreStatus(status: StoreStatus | null): {
  label: string;
  tone: 'primary' | 'warning' | 'danger';
} {
  if (status === null) return { label: '매장 상태 확인 필요', tone: 'warning' };
  if (!status.isOpen) return { label: '영업 종료', tone: 'danger' };
  if (!status.isAcceptingOrders) return { label: '영업 중 · 접수 일시 중지', tone: 'warning' };
  return { label: '영업 중 · 접수 가능', tone: 'primary' };
}

const NO_OPERATIONS_PERMISSION = '품절·운영 설정 권한이 없어요';

type TopBarProps = {
  status: StoreStatus | null;
  /** `null` while orders are loading or failed: never show a count we cannot trust. */
  newOrderCount: number | null;
  soldOutCount: number;
  isSoundOn: boolean;
  isConnected: boolean;
  /** MANAGE_OPERATIONS: store status and sold-out controls. UX only; the server enforces it. */
  canManageOperations: boolean;
  onToggleSound: () => void;
  onOpenStatus: () => void;
  onOpenSoldOut: () => void;
};

/** Compact bar: store status, new-order indicator, sound state, sold-out shortcut. */
export function TopBar({
  status,
  newOrderCount,
  soldOutCount,
  isSoundOn,
  isConnected,
  canManageOperations,
  onToggleSound,
  onOpenStatus,
  onOpenSoldOut,
}: TopBarProps) {
  const { label, tone } = describeStoreStatus(status);
  const hasNew = newOrderCount !== null && newOrderCount > 0;
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <Logo />
        <div className="leading-tight">
          <p className="text-lg font-bold">주문 관리</p>
          <p className="text-xs text-muted-foreground">더 올리브 카페</p>
        </div>
      </div>

      <Button
        variant={BUTTON_VARIANT.OUTLINE}
        size={BUTTON_SIZE.LG}
        onClick={onOpenStatus}
        disabled={!canManageOperations}
        title={canManageOperations ? undefined : NO_OPERATIONS_PERMISSION}
        aria-label={`매장 상태: ${label}. 빠른 설정 열기`}
      >
        <span
          className={cn(
            'size-2.5 rounded-full',
            tone === 'primary'
              ? 'bg-primary'
              : tone === 'warning'
                ? 'bg-warning'
                : 'bg-destructive',
          )}
          aria-hidden="true"
        />
        {label}
      </Button>

      {!isConnected ? (
        <Badge tone={BADGE_TONE.WARNING} icon={<WifiOff className="size-3.5" aria-hidden="true" />}>
          연결 끊김
        </Badge>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <p
          aria-live="polite"
          className={cn(
            'inline-flex h-12 items-center gap-2 rounded-full px-4 text-base font-bold',
            hasNew
              ? 'bg-primary text-primary-foreground motion-safe:animate-new-pulse'
              : 'bg-card text-muted-foreground ring-1 ring-border',
          )}
        >
          <Bell className="size-5" aria-hidden="true" />
          {newOrderCount === null
            ? '신규 주문 확인 중'
            : hasNew
              ? `신규 주문 ${newOrderCount}건`
              : '신규 주문 없음'}
        </p>
        <Button
          variant={BUTTON_VARIANT.OUTLINE}
          size={BUTTON_SIZE.LG}
          aria-pressed={isSoundOn}
          onClick={onToggleSound}
          icon={
            isSoundOn ? (
              <Volume2 className="size-5" aria-hidden="true" />
            ) : (
              <VolumeX className="size-5" aria-hidden="true" />
            )
          }
        >
          알림음 {isSoundOn ? '켜짐' : '꺼짐'}
        </Button>
        <Button
          variant={BUTTON_VARIANT.SECONDARY}
          size={BUTTON_SIZE.LG}
          onClick={onOpenSoldOut}
          disabled={!canManageOperations}
          title={canManageOperations ? undefined : NO_OPERATIONS_PERMISSION}
          icon={<PackageX className="size-5" aria-hidden="true" />}
        >
          품절 관리{soldOutCount > 0 ? ` (${soldOutCount})` : ''}
        </Button>
      </div>
    </header>
  );
}
