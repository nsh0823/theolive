import { useQuery } from '@tanstack/react-query';
import type { Profile } from '@theolive/types';

import type { TypedSupabaseClient } from './client';
import { queryKeys } from './query-keys';

export async function fetchProfile(client: TypedSupabaseClient, id: string): Promise<Profile> {
  const { data, error } = await client.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export function useProfile(client: TypedSupabaseClient, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profiles.detail(id ?? ''),
    queryFn: () => fetchProfile(client, id!),
    enabled: !!id,
  });
}
