import { FunctionsHttpError } from '@supabase/supabase-js';
import { APP_ERROR, toAppErrorCode, type AppErrorCode } from '@theolive/types';

/** Edge Functions answer `{ error: { code, message } }`; this reads the code from a failed invoke. */
export async function parseFunctionError(error: unknown): Promise<AppErrorCode> {
  if (error instanceof FunctionsHttpError) {
    const body: unknown = await error.context.json().catch(() => null);
    if (typeof body === 'object' && body !== null && 'error' in body) {
      return toAppErrorCode(body.error);
    }
  }
  return APP_ERROR.INTERNAL;
}

/** Thrown by hooks so callers can branch on `code` and show the Korean message. */
export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}
