import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { APP_ERROR, type Database } from '@theolive/types';

import { signInWithEmail, signOut } from './auth';
import type { TypedSupabaseClient } from './client';
import { fetchMyStaffAccess, fetchStaffList, updateStaff } from './staff';

// Runs against the LOCAL Supabase stack with the seeded accounts (supabase/seed.sql).
//   SUPABASE_INTEGRATION_URL=http://127.0.0.1:54321 SUPABASE_INTEGRATION_ANON_KEY=<publishable key> pnpm --filter @theolive/api test
const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const SEED_PASSWORD = 'olive-local-1234';

async function signedInClient(email: string): Promise<TypedSupabaseClient> {
  if (!url || !anonKey) throw new Error('integration env missing');
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
  await signInWithEmail(client, { email, password: SEED_PASSWORD });
  return client;
}

describe.skipIf(!url || !anonKey)('auth and roles against local Supabase', () => {
  it('customer has no staff role and cannot list staff', async () => {
    const client = await signedInClient('customer1@theolive.local');
    await expect(fetchMyStaffAccess(client)).resolves.toBeNull();
    await expect(fetchStaffList(client)).rejects.toMatchObject({ code: APP_ERROR.FORBIDDEN });
    await signOut(client);
  });

  it('barista has only PROCESS_ORDERS and cannot list staff', async () => {
    const client = await signedInClient('barista@theolive.local');
    const access = await fetchMyStaffAccess(client);
    expect(access).toMatchObject({
      role: 'STAFF',
      permissions: ['PROCESS_ORDERS'],
      isActive: true,
    });
    await expect(fetchStaffList(client)).rejects.toMatchObject({ code: APP_ERROR.FORBIDDEN });
  });

  it('inactive staff is reported inactive', async () => {
    const client = await signedInClient('inactive@theolive.local');
    await expect(fetchMyStaffAccess(client)).resolves.toMatchObject({ isActive: false });
  });

  it('admin lists staff and cannot demote or deactivate the only admin', async () => {
    const client = await signedInClient('admin@theolive.local');
    const access = await fetchMyStaffAccess(client);
    expect(access?.role).toBe('ADMIN');
    const staff = await fetchStaffList(client);
    expect(staff.length).toBeGreaterThanOrEqual(4);
    const self = staff.find((member) => member.email === 'admin@theolive.local');
    expect(self).toBeDefined();
    await expect(
      updateStaff(client, {
        userId: self?.id ?? '',
        displayName: '김올리',
        role: 'ADMIN',
        permissions: ['PROCESS_ORDERS'],
        isActive: false,
      }),
    ).rejects.toMatchObject({ code: APP_ERROR.LAST_ADMIN });
  });
});
