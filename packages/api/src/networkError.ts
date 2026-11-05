const NETWORK_ERROR_PATTERN =
  /network request failed|failed to fetch|fetch failed|network error|networkerror|load failed|timed out/i;

/** True when a request failed because the device could not reach the server (as opposed to a server refusal). */
export function isNetworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const message: unknown = 'message' in error ? error.message : undefined;
  return typeof message === 'string' && NETWORK_ERROR_PATTERN.test(message);
}
