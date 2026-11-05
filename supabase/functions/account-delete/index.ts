// account-delete (AUTH-04, OQ-34): deletes the caller's own account. The caller's JWT is verified, the id to delete
// is always that user's id (never taken from the body), and the work happens in one SQL transaction
// (`delete_account`): unpaid checkouts are cancelled, rewards are forfeited on both ledgers, personal data is
// scrubbed, the login is ended. Orders and payments are retained. It never hard-deletes the profile or the auth
// user (see migration 17). Refused with ACTIVE_ORDER_EXISTS while an order is in progress. Safe to repeat.
import { adminClient, authenticate } from '../_shared/clients.ts';
import { HTTP, HttpError, isErrorCode } from '../_shared/errors.ts';
import { jsonResponse, readJson, serveFunction } from '../_shared/http.ts';
import { accountDeleteSchema } from '../_shared/validation/account.ts';

serveFunction('account-delete', async (request) => {
  const { user } = await authenticate(request);
  const parsed = accountDeleteSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError('INVALID_INPUT');

  const { error } = await adminClient().rpc('delete_account', { p_user_id: user.id });
  if (error) {
    // Database rules arrive as `P0001` with the app error code as the message.
    if (isErrorCode(error.message)) throw new HttpError(error.message);
    throw error;
  }
  return jsonResponse(HTTP.OK, { deleted: true });
});
