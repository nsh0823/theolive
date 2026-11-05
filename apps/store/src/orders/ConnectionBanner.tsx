import { RefreshCw, WifiOff } from 'lucide-react';
import { Button, BUTTON_SIZE, BUTTON_VARIANT } from '@/ui/Button';

type ConnectionBannerProps = { onReconnect: () => void };

/** Realtime is not guaranteed (CLAUDE.md): on reconnect the board refetches pending orders. Visual stub only. */
export function ConnectionBanner({ onReconnect }: ConnectionBannerProps) {
  return (
    <div
      role="alert"
      className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-warning sm:mx-6"
    >
      <WifiOff className="size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm font-semibold">
        실시간 연결이 끊겼어요. 재연결을 시도하는 중이며, 새 주문이 늦게 보일 수 있어요. 연결되면
        미처리 주문을 다시 불러옵니다.
      </p>
      <Button
        size={BUTTON_SIZE.LG}
        variant={BUTTON_VARIANT.OUTLINE}
        icon={<RefreshCw className="size-4" aria-hidden="true" />}
        onClick={onReconnect}
      >
        지금 다시 연결
      </Button>
    </div>
  );
}
