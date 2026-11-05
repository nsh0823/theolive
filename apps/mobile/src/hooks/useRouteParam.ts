import { useLocalSearchParams } from 'expo-router';

/** Route params arrive as `string | string[] | undefined`; narrow to one string or null. */
export function useRouteParam(name: string): string | null {
  const params = useLocalSearchParams();
  const value = params[name];
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) return value[0];
  return null;
}
