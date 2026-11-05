import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { TypedSupabaseClient } from './client';
import { AppError, parseFunctionError } from './functionErrors';

/**
 * AUTH-04: deletes the signed-in member's account through the `account-delete` Edge Function (rewards forfeited,
 * personal data scrubbed, orders and payments retained, login ended). Rejects with `ACTIVE_ORDER_EXISTS` while an
 * order is in progress. The id to delete is the caller's own; it is never sent.
 */
export async function deleteAccount(client: Pick<TypedSupabaseClient, 'functions'>): Promise<void> {
  const { error } = await client.functions.invoke<unknown>('account-delete', {
    body: { confirm: true },
  });
  if (error) throw new AppError(await parseFunctionError(error));
}

/** After a successful deletion the local session is dropped and every cached query is cleared. */
export function useDeleteAccount(client: TypedSupabaseClient) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await deleteAccount(client);
      // The server already ended every session; this clears the stored one. A failure here is not a failed deletion.
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) console.error('Local sign-out after account deletion failed', error);
    },
    onSuccess: () => queryClient.clear(),
  });
}
