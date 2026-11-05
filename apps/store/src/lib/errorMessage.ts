import { APP_ERROR_MESSAGE, toAppErrorCode } from '@theolive/types';

/** Plain-language message for a failed server call (AppError, Supabase error or anything else). */
export function describeError(error: unknown): string {
  return APP_ERROR_MESSAGE[toAppErrorCode(error instanceof Error ? error : null)];
}
