import type { TypedSupabaseClient } from './client';

export type EmailCredentials = { email: string; password: string };

/** Email/password sign-in: local/dev for customers (OQ-3), the real method for staff (OQ-4). */
export async function signInWithEmail(
  client: TypedSupabaseClient,
  { email, password }: EmailCredentials,
): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(client: TypedSupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function setPassword(client: TypedSupabaseClient, password: string): Promise<void> {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export const SOCIAL_PROVIDER = { KAKAO: 'kakao', GOOGLE: 'google', APPLE: 'apple' } as const;
export type SocialProvider = (typeof SOCIAL_PROVIDER)[keyof typeof SOCIAL_PROVIDER];

/**
 * Starts an OAuth (PKCE) sign-in and returns the provider URL for the app to open.
 * The app finishes it by passing the `code` from the redirect deep link to `completeOAuthSignIn`.
 */
export async function startOAuthSignIn(
  client: TypedSupabaseClient,
  provider: SocialProvider,
  redirectTo: string,
): Promise<string> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  return data.url;
}

/** Exchanges the one-time `code` from the OAuth redirect for a session. */
export async function completeOAuthSignIn(
  client: TypedSupabaseClient,
  code: string,
): Promise<void> {
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
}
