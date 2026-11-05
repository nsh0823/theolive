import {
  CHANNEL_STATE,
  STORE_ORDER_EVENT,
  useCatalogChannel,
  useStoreOrdersChannel,
  useStoreSettings,
} from '@theolive/api';
import { useCallback } from 'react';
import { useSupabase } from '@/auth/AuthContext';
import { useOnline } from '@/lib/useOnline';
import { useToast } from '@/ui/Toast';

/**
 * Realtime for the board: the `store:orders` channel (order events) and the `store:catalog` channel (menu and
 * store switches). Both hooks refetch their queries on every event and on every (re)subscription. The board counts
 * as connected unless the browser is offline or a channel dropped.
 */
export function useBoardConnection(): { isConnected: boolean } {
  const client = useSupabase();
  const { notify } = useToast();
  const settings = useStoreSettings(client);
  const showBanner = settings.data?.notifications.newOrderBanner ?? true;

  // The alert sound is not played yet (no audio asset); the banner path is the visible alert.
  const onOrderEvent = useCallback(
    (event: string) => {
      if (event === STORE_ORDER_EVENT.ORDER_PAID && showBanner) notify('새 주문이 들어왔어요');
    },
    [notify, showBanner],
  );

  const ordersChannel = useStoreOrdersChannel(client, onOrderEvent);
  const catalogChannel = useCatalogChannel(client);
  const isOnline = useOnline();
  const isConnected =
    isOnline &&
    ordersChannel !== CHANNEL_STATE.DISCONNECTED &&
    catalogChannel !== CHANNEL_STATE.DISCONNECTED;
  return { isConnected };
}
