import { useUpdateNickname } from '@theolive/api';

import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { useSession } from '@/hooks/useAuth';
import { loginProviderLabel } from '@/lib/labels';
import { toQueryState, type QueryState } from '@/lib/queryState';
import type { Profile } from '@/models';
import { supabase } from '@/services/supabase';

/**
 * The member's profile for display. The nickname comes from `profiles`; email and sign-in method come from the
 * auth session, because contact data never lives in a public table.
 */
export function useProfileQuery(): QueryState<Profile> {
  const { session } = useSession();
  const state = toQueryState(useCurrentProfile());
  if (state.status !== 'success') return state;
  return {
    status: 'success',
    data: {
      displayName: state.data.nickname,
      email: session?.user.email ?? '',
      loginProvider: loginProviderLabel(session?.user.app_metadata.provider),
    },
  };
}

export function useUpdateNicknameMutation() {
  const { session } = useSession();
  return useUpdateNickname(supabase, session?.user.id);
}
