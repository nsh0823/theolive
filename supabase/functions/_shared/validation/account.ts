import { z } from 'zod';

/** `account-delete` body: the app sends `confirm: true` only after the member confirmed in the dialog. */
export const accountDeleteSchema = z.strictObject({ confirm: z.literal(true) });
export type AccountDeleteInput = z.infer<typeof accountDeleteSchema>;
