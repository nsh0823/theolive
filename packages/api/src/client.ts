import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '@theolive/types';

export type SupabaseClientOptions = {
  url: string;
  anonKey: string;
  /** Platform-specific session storage (e.g. expo-secure-store on mobile). */
  storage: SupportedStorage;
  /** Web only: pick up the session from the URL (invite and password-recovery links). */
  detectSessionInUrl?: boolean;
};

export function createSupabaseClient({
  url,
  anonKey,
  storage,
  detectSessionInUrl = false,
}: SupabaseClientOptions) {
  return createClient<Database>(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl,
      // PKCE so OAuth redirects return a one-time code instead of tokens in the URL.
      flowType: 'pkce',
    },
  });
}

export type TypedSupabaseClient = ReturnType<typeof createSupabaseClient>;
