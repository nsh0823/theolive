import { useMutation } from '@tanstack/react-query';

import { useAuthContext } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export function useSession() {
  return useAuthContext();
}

type Credentials = { email: string; password: string };

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: Credentials) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  });
}
