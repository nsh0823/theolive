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
        headerTitleStyle: { color: titleColor },
        headerLargeTitleStyle: { color: titleColor },
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
