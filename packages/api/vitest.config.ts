import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The integration suites share one local stack: they sign users out, close the store and toggle sold-out
    // items, which would break each other's checkouts if the files ran in parallel.
    fileParallelism: false,
  },
});
