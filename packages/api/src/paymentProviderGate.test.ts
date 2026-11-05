import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Loaded by path so the package's tsc does not type-check the Deno-style `.ts` imports of the Edge Function code.
const GATE_PATH = join(__dirname, '../../../supabase/functions/_shared/payments/testGate.ts');

async function loadGate(): Promise<(providerId: string, allowTestPg: string | undefined) => void> {
  const gate: unknown = (await import(GATE_PATH)).assertProviderAllowed;
  if (typeof gate !== 'function') throw new Error('assertProviderAllowed is missing');
  return (providerId, allowTestPg) => {
    gate(providerId, allowTestPg);
  };
}

describe('assertProviderAllowed (TEST gateway switch)', () => {
  it('refuses TEST unless ALLOW_TEST_PG is exactly "true"', async () => {
    const assertAllowed = await loadGate();
    for (const flag of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
      expect(() => assertAllowed('TEST', flag), String(flag)).toThrowError(
        expect.objectContaining({ code: 'TEST_PG_DISABLED' }),
      );
    }
  });

  it('allows TEST when ALLOW_TEST_PG is "true"', async () => {
    const assertAllowed = await loadGate();
    expect(() => assertAllowed('TEST', 'true')).not.toThrow();
  });

  it('does not gate other providers', async () => {
    const assertAllowed = await loadGate();
    expect(() => assertAllowed('TOSS', undefined)).not.toThrow();
  });
});
