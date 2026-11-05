import { useDeleteAccount } from '@theolive/api';

import { supabase } from '@/services/supabase';

/** AUTH-04: deletes the signed-in member's account on the server; the local session ends when it succeeds. */
export const useDeleteAccountMutation = () => useDeleteAccount(supabase);
