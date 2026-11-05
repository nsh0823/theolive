import { createSupabaseClient } from '@theolive/api';
import { env } from '@/env';

/** Imported by `main.tsx` only; everything else receives the client through `SupabaseProvider`. */
export const supabase = createSupabaseClient({
  url: env.supabaseUrl,
  anonKey: env.supabaseAnonKey,
  storage: window.localStorage,
  // Invite links arrive with the session in the URL (see /set-password).
  detectSessionInUrl: true,
});
