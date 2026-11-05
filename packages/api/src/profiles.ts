import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    queryFn: () => {
      if (!id) throw new Error('useProfile requires a user id');
      return fetchProfile(client, id);
    },
    enabled: Boolean(id),
  });
}

/** RLS and column grants allow a customer to change only their own nickname. */
export async function updateNickname(
  client: TypedSupabaseClient,
  id: string,
  nickname: string,
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update({ nickname })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function useUpdateNickname(client: TypedSupabaseClient, id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nickname: string) => {
      if (!id) throw new Error('useUpdateNickname requires a user id');
      return updateNickname(client, id, nickname);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all }),
  });
}
