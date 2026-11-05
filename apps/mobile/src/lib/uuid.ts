const UUID_VERSION_4 = 0x40;
const UUID_VARIANT_RFC4122 = 0x80;
const BYTE_RANGE = 256;
const UUID_BYTES = 16;

type RandomSource = { randomUUID?: () => string };

/**
 * Idempotency key for one checkout attempt. Uses the platform's crypto when present; the fallback
 * only needs to be unique per attempt (the server scopes keys to the signed-in customer), not secret.
 */
export function createRequestId(source: RandomSource | undefined = globalThis.crypto): string {
  if (source?.randomUUID) return source.randomUUID();
  const bytes = Array.from({ length: UUID_BYTES }, () => Math.floor(Math.random() * BYTE_RANGE));
  bytes[6] = ((bytes[6] ?? 0) % 16) | UUID_VERSION_4;
  bytes[8] = ((bytes[8] ?? 0) % 64) | UUID_VARIANT_RFC4122;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
