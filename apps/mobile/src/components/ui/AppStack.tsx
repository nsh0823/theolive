import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { useToneColor } from '@/lib/useToneColor';

/**
 * Native stack (react-native-screens) with DESIGN.md tokens applied only through the
 * native header options: tint, title color, and canvas background.
 */
export function AppStack({ children, ...props }: ComponentProps<typeof Stack>) {
  const tint = useToneColor('primary');
  const titleColor = useToneColor('foreground');
  const canvas = useToneColor('background');
  return (
    <Stack
      {...props}
      screenOptions={{
        headerTintColor: tint,
        headerTitleStyle: { color: titleColor, fontWeight: '700' },
        // Starbucks-style pattern: big, bold, left-aligned page titles on every screen.
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerLargeTitleStyle: { color: titleColor },
        headerLargeStyle: { backgroundColor: canvas },
        headerStyle: { backgroundColor: canvas },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: canvas },
      }}
    >
      {children}
    </Stack>
  );
}
