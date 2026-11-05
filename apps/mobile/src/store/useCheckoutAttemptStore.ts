import { create } from 'zustand';

import { createRequestId } from '@/lib/uuid';

type AttemptState = {
  fingerprint: string | null;
  clientRequestId: string | null;
  /** Same request contents -> same id (a retry or double tap replays the same order); new contents -> new id. */
  idFor: (fingerprint: string) => string;
  /** Call once the attempt's result is known (paid, failed, cancelled) so the next checkout is a new order. */
  reset: () => void;
};

/** In-memory: an attempt that survives only as long as the app process (a killed app recovers via payment status). */
export const useCheckoutAttemptStore = create<AttemptState>()((set, get) => ({
  fingerprint: null,
  clientRequestId: null,
  idFor: (fingerprint) => {
    const { fingerprint: current, clientRequestId } = get();
    if (clientRequestId !== null && current === fingerprint) return clientRequestId;
    const next = createRequestId();
    set({ fingerprint, clientRequestId: next });
    return next;
  },
  reset: () => set({ fingerprint: null, clientRequestId: null }),
}));
