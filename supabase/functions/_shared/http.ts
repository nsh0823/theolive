import { ERRORS, HTTP, HttpError, type ErrorCode } from './errors.ts';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(code: ErrorCode): Response {
  const spec = ERRORS[code];
  return jsonResponse(spec.status, { error: { code, message: spec.message } });
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export async function readJson(request: Request): Promise<unknown> {
  return await request.json().catch(() => null);
}

/**
 * Wraps a handler: CORS preflight, POST only, and one place that turns failures into the shared error body.
 * Unexpected errors are logged with the function name and answered as INTERNAL (no details leak to clients).
 */
export function serveFunction(
  name: string,
  handler: (request: Request) => Promise<Response>,
): void {
  Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') return errorResponse('INVALID_INPUT');
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error.code);
      console.error(`${name} failed`, error);
      return jsonResponse(HTTP.INTERNAL, {
        error: { code: 'INTERNAL', message: ERRORS.INTERNAL.message },
      });
    }
  });
}

/** Constant-time string comparison for secrets and signatures. */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}
