const { defineConfig } = require('eslint/config');
const sharedConfig = require('@theolive/config/eslint');

module.exports = defineConfig([
  sharedConfig,
  {
    // docs/STANDARDS.md: no any, no non-null assertions, no `as` casts (except `as const`).
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
]);
