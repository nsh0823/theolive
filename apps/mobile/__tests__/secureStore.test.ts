import { LargeSecureStore } from '@/services/secureStore';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}));

beforeEach(() => mockStore.clear());

describe('LargeSecureStore', () => {
  it('round-trips values larger than a single SecureStore entry', async () => {
    const value = 'x'.repeat(5000);
    await LargeSecureStore.setItem('session', value);

    expect(mockStore.get('session.chunks')).toBe('3');
    await expect(LargeSecureStore.getItem('session')).resolves.toBe(value);
  });

  it('drops stale chunks when a value shrinks', async () => {
    await LargeSecureStore.setItem('session', 'x'.repeat(5000));
    await LargeSecureStore.setItem('session', 'short');

    expect(mockStore.has('session.1')).toBe(false);
    await expect(LargeSecureStore.getItem('session')).resolves.toBe('short');
  });

  it('returns null for missing keys and after removal', async () => {
    await expect(LargeSecureStore.getItem('missing')).resolves.toBeNull();

    await LargeSecureStore.setItem('session', 'value');
    await LargeSecureStore.removeItem('session');
    await expect(LargeSecureStore.getItem('session')).resolves.toBeNull();
    expect(mockStore.size).toBe(0);
  });
});
