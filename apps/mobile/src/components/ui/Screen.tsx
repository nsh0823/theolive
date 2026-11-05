import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** DESIGN.md: bottom clearance so sticky totals never overlap content. */
const FOOTER_CLEARANCE = 88;

type Props = PropsWithChildren<{ footer?: ReactNode }>;

/**
 * Scrolling page under a native header. `contentInsetAdjustmentBehavior` lets iOS
 * place content below the native (large-title) header.
 */
export function Screen({ children, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-5 p-4"
        contentContainerStyle={{ paddingBottom: footer ? FOOTER_CLEARANCE + insets.bottom : 16 }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          className="absolute inset-x-0 bottom-0 gap-3 bg-card px-4 pt-3 shadow-lg"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
