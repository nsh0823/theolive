import { describe, expect, it, vi } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { APP_ERROR } from '@theolive/types';

import { AppError, parseFunctionError } from './functionErrors';
import { fetchMyStaffAccess, fetchStaffList, updateStaff } from './staff';

describe('fetchMyStaffAccess', () => {
  it('returns null for a customer (no rows)', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) };
    await expect(fetchMyStaffAccess(client)).resolves.toBeNull();
  });

  it('maps the role row and expands admin permissions', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ role: 'ADMIN', permissions: [], is_active: true }],
        error: null,
      }),
    };
    const access = await fetchMyStaffAccess(client);
    expect(access?.role).toBe('ADMIN');
    expect(access?.permissions).toEqual(['PROCESS_ORDERS', 'MANAGE_OPERATIONS']);
  });

  it('throws when the RPC fails', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) };
    await expect(fetchMyStaffAccess(client)).rejects.toEqual({ message: 'boom' });
  });
});

describe('fetchStaffList and updateStaff', () => {
  it('maps rows to the list view model', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            user_id: 'u1',
            email: 'a@b.co',
            display_name: '이름',
            role: 'STAFF',
            permissions: ['PROCESS_ORDERS'],
            is_active: false,
            created_at: '2026-11-05T00:00:00Z',
          },
        ],
        error: null,
      }),
    };
    await expect(fetchStaffList(client)).resolves.toEqual([
      {
        id: 'u1',
        name: '이름',
        email: 'a@b.co',
        role: 'STAFF',
        isActive: false,
        permissions: ['PROCESS_ORDERS'],
      },
    ]);
  });

  it('turns a server error message into an AppError code', async () => {
    const client = {
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: 'P0001', message: 'LAST_ADMIN' } }),
    };
    await expect(
      updateStaff(client, {
        userId: 'u1',
        displayName: 'x',
        role: 'ADMIN',
        permissions: ['PROCESS_ORDERS'],
        isActive: false,
      }),
    ).rejects.toMatchObject({ code: APP_ERROR.LAST_ADMIN });
    await expect(fetchStaffList(client)).rejects.toBeInstanceOf(AppError);
  });
});

describe('parseFunctionError', () => {
  it('reads the code from an Edge Function error body', async () => {
    const response = new Response(
      JSON.stringify({ error: { code: 'ALREADY_STAFF', message: 'x' } }),
      {
        status: 409,
      },
    );
    await expect(parseFunctionError(new FunctionsHttpError(response))).resolves.toBe(
      APP_ERROR.ALREADY_STAFF,
    );
  });

  it('falls back to INTERNAL for non-JSON bodies and unknown errors', async () => {
    await expect(
      parseFunctionError(new FunctionsHttpError(new Response('oops', { status: 500 }))),
    ).resolves.toBe(APP_ERROR.INTERNAL);
    await expect(parseFunctionError(new Error('network'))).resolves.toBe(APP_ERROR.INTERNAL);
  });
});
