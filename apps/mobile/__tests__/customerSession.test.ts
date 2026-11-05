import { classifySession, SESSION_VERDICT } from '@/lib/customerSession';

describe('classifySession (OQ-5: staff accounts cannot use the customer app)', () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  afterAll(() => consoleError.mockRestore());

  it('accepts a customer account (no staff row)', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: [], error: null }) };
    await expect(classifySession(client)).resolves.toBe(SESSION_VERDICT.CUSTOMER);
  });

  it('rejects active staff and admins', async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: [{ role: 'STAFF', permissions: [], is_active: true }],
        error: null,
      }),
    };
    await expect(classifySession(client)).resolves.toBe(SESSION_VERDICT.STAFF_REJECTED);
  });

  it('rejects deactivated staff too: the account is still not a customer account', async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: [{ role: 'ADMIN', permissions: [], is_active: false }],
        error: null,
      }),
    };
    await expect(classifySession(client)).resolves.toBe(SESSION_VERDICT.STAFF_REJECTED);
  });

  it('keeps the session but reports unverified when the role cannot be read', async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'network' } }),
    };
    await expect(classifySession(client)).resolves.toBe(SESSION_VERDICT.UNVERIFIED);
    expect(consoleError).toHaveBeenCalled();
  });
});
