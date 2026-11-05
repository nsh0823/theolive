import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { QueryClient, onlineManager } from '@tanstack/react-query';

import { connectNetworkState, isOnlineState } from '@/lib/network';

type Listener = (state: NetInfoState) => void;

function state(isConnected: boolean | null, isInternetReachable: boolean | null): NetInfoState {
  return { isConnected, isInternetReachable } as unknown as NetInfoState;
}

describe('isOnlineState', () => {
  it('is online when connected and reachability is true or still unknown', () => {
    expect(isOnlineState(state(true, true))).toBe(true);
    expect(isOnlineState(state(true, null))).toBe(true);
  });

  it('is offline when disconnected or the internet is unreachable', () => {
    expect(isOnlineState(state(false, false))).toBe(false);
    expect(isOnlineState(state(null, null))).toBe(false);
    expect(isOnlineState(state(true, false))).toBe(false);
  });
});

describe('connectNetworkState', () => {
  it('pauses queries offline and invalidates server data once on reconnect', () => {
    let listener: Listener = () => undefined;
    const unsubscribe = jest.fn();
    jest.mocked(NetInfo.addEventListener).mockImplementation((next) => {
      listener = next;
      return unsubscribe;
    });
    const queryClient = new QueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    const disconnect = connectNetworkState(queryClient);
    listener(state(false, false));
    expect(onlineManager.isOnline()).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();

    listener(state(true, true));
    expect(onlineManager.isOnline()).toBe(true);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey?.[0]);
    expect(keys).toEqual(['menu', 'store', 'orders', 'payments']);

    listener(state(true, true));
    expect(invalidate).toHaveBeenCalledTimes(4);

    disconnect();
    expect(unsubscribe).toHaveBeenCalled();
    onlineManager.setOnline(true);
  });
});
