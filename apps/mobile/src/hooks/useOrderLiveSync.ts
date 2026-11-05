import { queryKeys, useCatalogChannel, useUserOrdersChannel } from '@theolive/api';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';

/**
 * Keeps order, menu and store screens live: the private `user:<uid>` channel refetches on every event and every
 * (re)subscription, and returning to the foreground refetches too, because events sent while the app was
 * in the background are lost. Realtime is a hint only; the server stays the source of truth.
 */
export function useOrderLiveSync(): void {
  const { session } = useSession();
  const queryClient = useQueryClient();
  useUserOrdersChannel(supabase, session?.user.id ?? null);
  useCatalogChannel(supabase);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.menu.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.store.all });
    });
    return () => subscription.remove();
  }, [queryClient]);
}
