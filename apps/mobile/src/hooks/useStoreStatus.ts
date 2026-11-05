import { useStoreStatus, type StoreStatusView } from '@theolive/api';

import { availabilityOf, type Availability } from '@/lib/storeAvailability';
import { toQueryState, type QueryState } from '@/lib/queryState';
import { supabase } from '@/services/supabase';

export function useStoreStatusQuery(): QueryState<StoreStatusView> {
  return toQueryState(useStoreStatus(supabase));
}

/** Whether the order screens should allow ordering right now (SW-08, ORD-05). */
export function useOrderAvailability(): Availability {
  const state = useStoreStatusQuery();
  return availabilityOf(state.status === 'success' ? state.data : null);
}
