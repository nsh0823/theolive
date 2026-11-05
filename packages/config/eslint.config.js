// Shared flat ESLint config for every workspace.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/**', 'coverage/**', '.expo/**', 'ios/**', 'android/**', '*-types.d.ts'],
  },
]);
