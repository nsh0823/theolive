/**
 * Visible height of the native floating tab bar (iOS) / bottom navigation (Android), excluding
 * the home-indicator inset. NativeTabs does not inset our nested ScrollViews, so screens reserve
 * this space themselves. Measured by eye, not on a device: adjust here if it clips.
 */
export const TAB_BAR_HEIGHT = 64;

/** Breathing room between the last element and whatever sits below it. */
export const CONTENT_BOTTOM_GAP = 24;

/** Space a tab screen must reserve at its bottom so the tab bar never covers content. */
export function tabBarClearance(bottomInset: number): number {
  return bottomInset + TAB_BAR_HEIGHT;
}
