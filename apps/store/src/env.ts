// Vite inlines VITE_* at build time, so each variable is read by its full name.
const raw = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

const missing = Object.entries(raw)
  .filter(([, value]) => typeof value !== 'string' || value === '')
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Missing environment variables: ${missing.join(', ')}. Copy apps/store/.env.example to apps/store/.env.local and fill them in.`,
  );
}

function requireString(name: keyof typeof raw): string {
  const value = raw[name];
  if (typeof value !== 'string') throw new Error(`Environment variable ${name} must be a string`);
  return value;
}

/** Public configuration only: the anon/publishable key. Never put a service-role key here. */
export const env = {
  supabaseUrl: requireString('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireString('VITE_SUPABASE_ANON_KEY'),
};
