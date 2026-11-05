import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { CHANNEL_STATE, type ChannelState } from './catalogChannel';
import type { TypedSupabaseClient } from './client';
import { queryKeys } from './query-keys';

export const STORE_ORDERS_TOPIC = 'store:orders';
export const STORE_ORDER_EVENT = {
  ORDER_PAID: 'order_paid',
  ORDER_UPDATED: 'order_updated',
} as const;
export const USER_ORDER_EVENT = { ORDER_UPDATED: 'order_updated' } as const;
/** `reward_updated { asset: 'STAMP' | 'COUPON' }`: a stamp or coupon changed; refetch the reward queries. */
export const USER_REWARD_EVENT = { REWARD_UPDATED: 'reward_updated' } as const;
/** `notification_created { id, kind }`: a new in-app notification; refetch the list and the unread count. */
export const USER_NOTIFICATION_EVENT = { NOTIFICATION_CREATED: 'notification_created' } as const;

export function userTopic(userId: string): string {
  return `user:${userId}`;
}

const ORDER_KEYS = [queryKeys.orders.all, queryKeys.payments.all] as const;

type ChannelOptions = {
  topic: string;
  events: readonly string[];
  /** Query keys to refetch on every event and every (re)subscription. */
  keys: readonly (readonly unknown[])[];
  /** Called for every received event, e.g. to play the new-order sound. The payload is never cached. */
  onEvent?: (event: string) => void;
};

/**
 * Subscribes to a private Broadcast topic. Realtime is only a hint (P5): every event and every
 * (re)subscription invalidates the order queries, and nothing from the payload is written to the cache.
 * Returns the channel state so a screen can show a disconnected banner.
 */
function useOrderChannel(
  client: TypedSupabaseClient,
  options: ChannelOptions | null,
): ChannelState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ChannelState>(CHANNEL_STATE.CONNECTING);
  // The latest callback without resubscribing on every render.
  const onEventRef = useRef(options?.onEvent);
  const onEvent = options?.onEvent;
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  const topic = options?.topic;
  const eventsKey = options?.events.join(',');
  // Same for the keys: the effect below must not resubscribe because an inline array changed identity.
  const keysRef = useRef(options?.keys);
  const keys = options?.keys;
  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);

  useEffect(() => {
    if (!topic || !eventsKey) return undefined;
    let isActive = true;
    const refetchOrders = () => {
      for (const queryKey of keysRef.current ?? []) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    let channel = client.channel(topic, { config: { private: true } });
    for (const event of eventsKey.split(',')) {
      channel = channel.on('broadcast', { event }, () => {
        onEventRef.current?.(event);
        refetchOrders();
      });
    }
    channel.subscribe((status, error) => {
      if (!isActive) return;
      if (status === 'SUBSCRIBED') {
        setState(CHANNEL_STATE.SUBSCRIBED);
        // Events sent while disconnected are lost, so (re)subscribing always refetches.
        refetchOrders();
        return;
      }
      if (error) console.error('Order channel problem', topic, status, error);
      setState(CHANNEL_STATE.DISCONNECTED);
    });
    return () => {
      isActive = false;
      setState(CHANNEL_STATE.CONNECTING);
      void client.removeChannel(channel);
    };
  }, [client, queryClient, topic, eventsKey]);

  return state;
}

/** Store Web board: `store:orders` (staff with PROCESS_ORDERS only; the server enforces it). */
export function useStoreOrdersChannel(
  client: TypedSupabaseClient,
  onEvent?: (event: string) => void,
): ChannelState {
  return useOrderChannel(client, {
    topic: STORE_ORDERS_TOPIC,
    events: Object.values(STORE_ORDER_EVENT),
    keys: ORDER_KEYS,
    onEvent,
  });
}

/** Customer app: `user:<uid>` — only the owner can listen to it. Pass null while signed out. */
export function useUserOrdersChannel(
  client: TypedSupabaseClient,
  userId: string | null,
): ChannelState {
  return useOrderChannel(
    client,
    userId
      ? {
          topic: userTopic(userId),
          events: [
            ...Object.values(USER_ORDER_EVENT),
            ...Object.values(USER_REWARD_EVENT),
            ...Object.values(USER_NOTIFICATION_EVENT),
          ],
          keys: [...ORDER_KEYS, queryKeys.rewards.all, queryKeys.notifications.all],
        }
      : null,
  );
}
