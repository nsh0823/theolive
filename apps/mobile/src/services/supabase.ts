import 'react-native-url-polyfill/auto';
import { createSupabaseClient } from '@theolive/api';

import { env } from '@/env';
import { LargeSecureStore } from './secureStore';

export const supabase = createSupabaseClient({
  url: env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  storage: LargeSecureStore,
});
