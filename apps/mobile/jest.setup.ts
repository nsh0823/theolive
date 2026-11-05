process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// react-aria (via gluestack) patches `window.screen` when NODE_ENV=test; the RN test env has none.
if (typeof window !== 'undefined' && !window.screen) {
  Object.defineProperty(window, 'screen', { value: {}, configurable: true });
}
