const { defineConfig } = require('eslint/config');
const sharedConfig = require('@theolive/config/eslint');

module.exports = defineConfig([
  sharedConfig,
  // lint-staged runs ESLint from the repo root, where there is no tsconfig;
  // point the resolver at each workspace's so path aliases like `@/` resolve.
  {
    settings: {
      'import/resolver': {
        typescript: { project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] },
      },
    },
  },
]);
