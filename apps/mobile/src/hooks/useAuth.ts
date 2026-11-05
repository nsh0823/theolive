import { signInWithEmail, signOut, type EmailCredentials } from '@theolive/api';
import { useMutation } from '@tanstack/react-query';

import { useAuthContext } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export function useSession() {
  return useAuthContext();
}

export function useSignIn() {
  return useMutation({
    mutationFn: (credentials: EmailCredentials) => signInWithEmail(supabase, credentials),
  });
}

export function useSignOut() {
  return useMutation({ mutationFn: () => signOut(supabase) });
}
