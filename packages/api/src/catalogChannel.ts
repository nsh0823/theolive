import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { TypedSupabaseClient } from './client';
import { queryKeys } from './query-keys';

export const CATALOG_TOPIC = 'store:catalog';
export const CATALOG_EVENT = {
  MENU_UPDATED: 'menu_updated',
  STORE_STATUS_UPDATED: 'store_status_updated',
} as const;

export const CHANNEL_STATE = {
  CONNECTING: 'connecting',
  SUBSCRIBED: 'subscribed',
  DISCONNECTED: 'disconnected',
} as const;
export type ChannelState = (typeof CHANNEL_STATE)[keyof typeof CHANNEL_STATE];

/**
 * Listens to the private `store:catalog` broadcast (P5). Realtime is only a hint: every event and every
 * (re)subscription refetches menu and store queries, and payloads are never written into the cache.
 * Browser `online` / tab-focus refetches come from TanStack Query's own focus and online managers.
 */
export function useCatalogChannel(client: TypedSupabaseClient): ChannelState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ChannelState>(CHANNEL_STATE.CONNECTING);

  useEffect(() => {
    let isActive = true;
    const refetchCatalog = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.menu.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.store.all });
    };
    const channel = client
      .channel(CATALOG_TOPIC, { config: { private: true } })
      .on('broadcast', { event: CATALOG_EVENT.MENU_UPDATED }, refetchCatalog)
      .on('broadcast', { event: CATALOG_EVENT.STORE_STATUS_UPDATED }, refetchCatalog)
      .subscribe((status, error) => {
        if (!isActive) return;
        if (status === 'SUBSCRIBED') {
          setState(CHANNEL_STATE.SUBSCRIBED);
          // Events sent while disconnected are lost, so a (re)subscription always refetches.
          refetchCatalog();
          return;
        }
        if (error) console.error('Catalog channel problem', status, error);
        setState(CHANNEL_STATE.DISCONNECTED);
      });
    return () => {
      isActive = false;
      void client.removeChannel(channel);
    };
  }, [client, queryClient]);

  return state;
}
