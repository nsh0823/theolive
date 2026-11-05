// Expo inlines EXPO_PUBLIC_* at build time, so each variable must be read by its full name.
const raw = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

const missing = Object.entries(raw)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Missing environment variables: ${missing.join(', ')}. Copy apps/mobile/.env.example to apps/mobile/.env.local and fill them in.`,
  );
}

const required = raw as { [K in keyof typeof raw]: string };

export const env = {
  ...required,
  /**
   * Local/dev only (OQ-3): shows the email/password form for seeded test customers. Needs a dev build
   * (`__DEV__`) AND this flag, so it can never appear in a production bundle by accident.
   */
  enableDevLogin: process.env.EXPO_PUBLIC_ENABLE_DEV_LOGIN === 'true',
};
