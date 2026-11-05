import { useStoreSettings } from '@theolive/api';

import { toQueryState, type QueryState } from '@/lib/queryState';
import { supabase } from '@/services/supabase';

/** The store's phone number (inquiries go to the store, OTH-04). */
export function useStorePhoneQuery(): QueryState<string> {
  const state = toQueryState(useStoreSettings(supabase));
  return state.status === 'success' ? { status: 'success', data: state.data.info.phone } : state;
}
