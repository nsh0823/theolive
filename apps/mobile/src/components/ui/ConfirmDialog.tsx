import { Heading } from '@theolive/ui/components/heading';
import { Text } from '@theolive/ui/components/text';
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { CtaButton } from './CtaButton';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/** In-app confirmation (replaces OS alerts so actions and copy match the design system). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          className="absolute inset-0 bg-foreground opacity-40"
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        />
        <View
          className="w-full max-w-sm gap-4 rounded-xl bg-card p-6"
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View className="gap-2">
            <Heading size="md" accessibilityRole="header">
              {title}
            </Heading>
            {message ? <Text className="text-muted-foreground">{message}</Text> : null}
            {children}
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <CtaButton label={cancelLabel} variant="secondary" onPress={onCancel} />
            </View>
            <View className="flex-1">
              <CtaButton
                label={confirmLabel}
                variant={destructive ? 'destructive' : 'primary'}
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
