import { useProfile } from '@theolive/api';

import { supabase } from '@/services/supabase';
import { useSession } from './useAuth';

export function useCurrentProfile() {
  const { session } = useSession();
  return useProfile(supabase, session?.user.id);
}
