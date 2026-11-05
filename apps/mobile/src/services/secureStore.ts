import * as SecureStore from 'expo-secure-store';

// SecureStore may reject values over ~2048 bytes, and Supabase sessions can exceed that,
// so large values are split across several keys.
const CHUNK_SIZE = 1800;
const chunkCountKey = (key: string) => `${key}.chunks`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function removeChunks(key: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(chunkCountKey(key))) ?? 0);
  await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
  );
  await SecureStore.deleteItemAsync(chunkCountKey(key));
}

export const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(chunkCountKey(key));
    if (count === null) return null;

    const chunks = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    if (chunks.some((chunk) => chunk === null)) return null;
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await removeChunks(key);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [''];
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    await SecureStore.setItemAsync(chunkCountKey(key), String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await removeChunks(key);
  },
};
