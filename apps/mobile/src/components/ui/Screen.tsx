import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_BOTTOM_GAP, tabBarClearance } from '@/lib/layout';

type Props = PropsWithChildren<{
  /** Sticky bar pinned above the tab bar (totals, primary actions). */
  footer?: ReactNode;
  /** Set false only for screens outside the tab navigator (no tab bar to clear). */
  hasTabBar?: boolean;
  /** Tighter horizontal rhythm for flat lists that draw their own padding. */
  contentClassName?: string;
}>;

/**
 * Scrolling page under a native (large-title) header, on the #EFF4F8 canvas. The scroll content
 * reserves room for the floating tab bar and for the measured sticky footer, so the last
 * element is always reachable. The footer itself sits above the tab bar, not under it.
 */
export function Screen({
  children,
  footer,
  hasTabBar = true,
  contentClassName = 'gap-6 px-5 pt-2',
}: Props) {
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const bottomClearance = hasTabBar ? tabBarClearance(insets.bottom) : insets.bottom;
  const scrollPadding = bottomClearance + (footer ? footerHeight : 0) + CONTENT_BOTTOM_GAP;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        testID="screen-scroll"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName={contentClassName}
        contentContainerStyle={{ paddingBottom: scrollPadding }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          testID="screen-footer"
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          className="absolute inset-x-0 gap-3 border-t border-border bg-card px-5 pb-3 pt-3"
          style={{ bottom: bottomClearance }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
