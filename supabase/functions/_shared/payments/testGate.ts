import { HttpError } from '../errors.ts';

export const TEST_PROVIDER = 'TEST';

/** The TEST gateway moves no real money, so it only runs where ALLOW_TEST_PG is exactly "true". */
export function assertProviderAllowed(providerId: string, allowTestPg: string | undefined): void {
  if (providerId === TEST_PROVIDER && allowTestPg !== 'true')
    throw new HttpError('TEST_PG_DISABLED');
}
