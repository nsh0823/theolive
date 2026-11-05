import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { HttpError } from './errors.ts';
import { requireEnv } from './http.ts';

// Edge Functions use untyped clients: the generated Database type lives in packages/types, outside the bundle.
export type AnySupabaseClient = SupabaseClient;

/** Service-role client. Only Edge Functions hold this key; it never reaches an app. */
export function adminClient(): AnySupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

export type Caller = { client: AnySupabaseClient; user: User };

/** Verifies the caller's JWT and returns a client that acts as that user (row-level security applies). */
export async function authenticate(request: Request): Promise<Caller> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) throw new HttpError('UNAUTHENTICATED');
  const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError('UNAUTHENTICATED');
  return { client, user: data.user };
}
