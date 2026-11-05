import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@theolive/api';

/** `isInternetReachable` is null while unknown; only an explicit false counts as offline. */
export function isOnlineState(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Feeds NetInfo into TanStack Query: queries pause while offline and refetch on reconnect. On reconnect the
 * server-owned data behind the realtime channels (`store:catalog`, `user:<uid>`) is invalidated as well,
 * because broadcasts sent while offline are lost (realtime is only a hint). Returns the unsubscribe function.
 */
export function connectNetworkState(queryClient: QueryClient): () => void {
  let wasOnline = onlineManager.isOnline();
  let unsubscribe: () => void = () => undefined;
  onlineManager.setEventListener((setOnline) => {
    unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = isOnlineState(state);
      setOnline(isOnline);
      if (isOnline && !wasOnline) invalidateServerData(queryClient);
      wasOnline = isOnline;
    });
    return unsubscribe;
  });
  return () => unsubscribe();
}

function invalidateServerData(queryClient: QueryClient): void {
  for (const queryKey of [
    queryKeys.menu.all,
    queryKeys.store.all,
    queryKeys.orders.all,
    queryKeys.payments.all,
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
