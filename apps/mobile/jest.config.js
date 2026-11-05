// Packages that ship untranspiled ESM/TS and must go through Babel.
const transpiled = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  'expo-router',
  'react-navigation',
  '@react-navigation/.*',
  'react-native-svg',
  'lucide-react-native',
  '@gluestack-ui/.*',
  '@legendapp/.*',
  'tailwind-variants',
  'uniwind',
  '@theolive/.*',
];

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // The package's `react-native` export points at an .mjs build Jest cannot transform.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  // `\.pnpm` is skipped so the check applies to the real package path inside pnpm's store.
  transformIgnorePatterns: [`node_modules/(?!\\.pnpm|${transpiled.join('|')})`],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
