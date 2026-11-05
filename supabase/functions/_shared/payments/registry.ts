import type { AnySupabaseClient } from '../clients.ts';
import { requireEnv } from '../http.ts';
import type { PaymentProvider } from './provider.ts';
import { assertProviderAllowed } from './testGate.ts';
import { TestPaymentProvider } from './testProvider.ts';

/** Chooses the payment provider from the PAYMENT_PROVIDER secret. Only TEST exists until a gateway is chosen. */
export function getPaymentProvider(admin: AnySupabaseClient): PaymentProvider {
  const id = requireEnv('PAYMENT_PROVIDER');
  // Refused before any provider object exists, so no TEST checkout token can be issued.
  assertProviderAllowed(id, Deno.env.get('ALLOW_TEST_PG'));
  if (id === 'TEST') return new TestPaymentProvider(admin, requireEnv('PAYMENT_WEBHOOK_SECRET'));
  throw new Error(`Unsupported PAYMENT_PROVIDER ${id}`);
}
