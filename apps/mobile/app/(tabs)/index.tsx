import { Redirect } from 'expo-router';

// Legacy entry route: Home now lives in the `home` stack (see (tabs)/_layout.tsx).
export default function TabsIndex() {
  return <Redirect href="/home" />;
}
