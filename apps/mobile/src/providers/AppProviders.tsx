import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { GluestackUIProvider } from '@theolive/ui/components/gluestack-ui-provider';
import { useEffect, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaListener, SafeAreaProvider } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import { useAppStore } from '@/store/useAppStore';
import { connectNetworkState } from '@/lib/network';
import { AuthProvider } from './AuthProvider';
import { queryClient } from './query-client';

export function AppProviders({ children }: PropsWithChildren) {
  const colorMode = useAppStore((state) => state.colorMode);

  // Returning to the app refetches stale queries (menu, sold-out): realtime and connectivity events can be missed
  // while the app is in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  // NetInfo drives TanStack Query's online state (pause offline, refetch on reconnect).
  useEffect(() => connectNetworkState(queryClient), []);

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
