import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '@theolive/types';

export type SupabaseClientOptions = {
  url: string;
  anonKey: string;
  /** Platform-specific session storage (e.g. expo-secure-store on mobile). */
  storage: SupportedStorage;
};

export function createSupabaseClient({ url, anonKey, storage }: SupabaseClientOptions) {
  return createClient<Database>(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export type TypedSupabaseClient = ReturnType<typeof createSupabaseClient>;
