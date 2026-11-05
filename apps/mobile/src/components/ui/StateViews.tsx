import { Spinner } from '@theolive/ui/components/spinner';
import { Text } from '@theolive/ui/components/text';
import type { LucideIcon } from 'lucide-react-native';
import { Inbox, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { AppIcon } from './AppIcon';
import { CtaButton } from './CtaButton';

const STATE_ICON_SIZE = 40;

export function LoadingView({ label = '불러오는 중이에요' }: { label?: string }) {
  return (
    <View
      className="items-center gap-3 py-16"
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <Spinner />
      <Text size="sm" className="text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}

type EmptyProps = {
  message: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyView({ message, icon = Inbox, actionLabel, onAction }: EmptyProps) {
  return (
    <View className="items-center gap-4 py-16">
      <AppIcon icon={icon} tone="muted" size={STATE_ICON_SIZE} />
      <Text className="text-center text-muted-foreground">{message}</Text>
      {actionLabel && onAction ? (
        <CtaButton label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

type ErrorProps = { message: string; onRetry: () => void };

export function ErrorView({ message, onRetry }: ErrorProps) {
  return (
    <View className="items-center gap-4 py-16" accessibilityRole="alert">
      <AppIcon icon={WifiOff} tone="destructive" size={STATE_ICON_SIZE} />
      <Text className="text-center text-foreground">{message}</Text>
      <CtaButton label="다시 시도" onPress={onRetry} variant="outline" />
    </View>
  );
}

/** Disconnected: no offline ordering or local substitutes, so the only action is retry. */
export function OfflineView({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="items-center gap-4 py-16" accessibilityRole="alert">
      <AppIcon icon={WifiOff} tone="muted" size={STATE_ICON_SIZE} />
      <Text className="font-semibold text-foreground">인터넷에 연결되어 있지 않아요</Text>
      <Text size="sm" className="text-center text-muted-foreground">
        연결을 확인한 뒤 다시 시도해 주세요. 주문과 결제는 연결된 상태에서만 할 수 있어요.
      </Text>
      <CtaButton label="다시 연결하기" onPress={onRetry} variant="outline" />
    </View>
  );
}
