// admin-staff: lets an ADMIN invite a staff member (plan sections 3.4 and 7).
// The caller's JWT is verified, the caller must be an active ADMIN, then the service role
// creates the auth user and the staff_members row. The service-role key never leaves this function.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { staffInviteSchema } from '../_shared/validation/staff.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HTTP = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INTERNAL: 500,
} as const;

const bodySchema = z.object({ action: z.literal('INVITE') }).loose();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST')
    return errorResponse(HTTP.BAD_REQUEST, 'INVALID_INPUT', '잘못된 요청이에요.');

  const authorization = request.headers.get('Authorization');
  if (!authorization)
    return errorResponse(HTTP.UNAUTHORIZED, 'UNAUTHENTICATED', '로그인이 필요해요.');

  const url = requireEnv('SUPABASE_URL');
  const callerClient = createClient(url, requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return errorResponse(HTTP.UNAUTHORIZED, 'UNAUTHENTICATED', '로그인이 필요해요.');
  }
  const caller = userData.user;

  // Role is read from the database with the caller's own JWT, never from the request body.
  const { data: roleRows, error: roleError } = await callerClient.rpc('get_my_staff_role');
  if (roleError) throw roleError;
  const callerRole = roleRows?.[0];
  if (!callerRole || callerRole.role !== 'ADMIN' || !callerRole.is_active) {
    return errorResponse(HTTP.FORBIDDEN, 'FORBIDDEN', '이 작업을 할 권한이 없어요.');
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const action = bodySchema.safeParse(rawBody);
  const invite = staffInviteSchema.safeParse(rawBody);
  if (!action.success || !invite.success) {
    return errorResponse(HTTP.BAD_REQUEST, 'INVALID_INPUT', '입력한 내용을 확인해 주세요.');
  }
  const input = invite.data;

  const adminClient = createClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // STORE_WEB_URL (function secret) is the Store Web origin; the invite link lands on its /set-password page.
  const storeWebUrl = Deno.env.get('STORE_WEB_URL');
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: { nickname: input.displayName },
      redirectTo: storeWebUrl ? `${storeWebUrl}/set-password` : undefined,
    },
  );
  if (inviteError || !invited.user) {
    if (inviteError?.code === 'email_exists') {
      return errorResponse(HTTP.CONFLICT, 'INVALID_INPUT', '이미 가입된 이메일이에요.');
    }
    throw inviteError ?? new Error('Invite returned no user');
  }

  const { error: staffError } = await adminClient.rpc('admin_create_staff_record', {
    p_actor_id: caller.id,
    p_user_id: invited.user.id,
    p_role: input.role,
    p_permissions: input.permissions,
    p_display_name: input.displayName,
  });
  if (staffError) {
    // The invite call returns the existing user for a repeated email; that staff member must stay intact.
    if (staffError.message === 'ALREADY_STAFF') {
      return errorResponse(HTTP.CONFLICT, 'ALREADY_STAFF', '이미 등록된 직원이에요.');
    }
    // Do not leave an invited account without a staff row.
    await adminClient.auth.admin.deleteUser(invited.user.id);
    throw staffError;
  }

  return jsonResponse(HTTP.OK, { userId: invited.user.id });
}

Deno.serve(async (request) => {
  try {
    return await handle(request);
  } catch (error) {
    console.error('admin-staff failed', error);
    return errorResponse(HTTP.INTERNAL, 'INTERNAL', '문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
  }
});
