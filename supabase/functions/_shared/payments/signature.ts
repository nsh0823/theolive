// HMAC-SHA256 helpers for webhook signatures and the TEST checkout token.
const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(message),
  );
  return toHex(signature);
}

function toBase64Url(text: string): string {
  return btoa(String.fromCharCode(...encoder.encode(text)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function fromBase64Url(value: string): string {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

/** Signed token that lets the TEST sheet act on exactly one payment for a short time. */
export async function createCheckoutToken(
  secret: string,
  paymentId: string,
  expiresAtMs: number,
): Promise<string> {
  const body = toBase64Url(JSON.stringify({ p: paymentId, e: expiresAtMs }));
  return `${body}.${await hmacHex(secret, body)}`;
}

export type CheckoutTokenPayload = { paymentId: string };

export async function readCheckoutToken(
  secret: string,
  token: string,
  nowMs: number,
  safeEqual: (a: string, b: string) => boolean,
): Promise<CheckoutTokenPayload | null> {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  if (!safeEqual(await hmacHex(secret, body), signature)) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(body));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { p, e } = parsed as { p?: unknown; e?: unknown };
    if (typeof p !== 'string' || typeof e !== 'number' || e < nowMs) return null;
    return { paymentId: p };
  } catch (error) {
    console.error('Unreadable checkout token', error);
    return null;
  }
}
