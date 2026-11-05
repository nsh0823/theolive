import { QueryClientProvider } from '@tanstack/react-query';
import { GluestackUIProvider } from '@theolive/ui/components/gluestack-ui-provider';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaListener, SafeAreaProvider } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import { useAppStore } from '@/store/useAppStore';
import { AuthProvider } from './AuthProvider';
import { queryClient } from './query-client';

export function AppProviders({ children }: PropsWithChildren) {
  const colorMode = useAppStore((state) => state.colorMode);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
          <GluestackUIProvider mode={colorMode}>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>{children}</AuthProvider>
            </QueryClientProvider>
          </GluestackUIProvider>
        </SafeAreaListener>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
