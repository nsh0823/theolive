import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { resetAllFixtures } from '@/data/stores';
import { setFixtureLatency } from '@/data/useFixtureQuery';

// Fixture queries resolve immediately in tests; the app uses a short delay to show loading states.
setFixtureLatency(0);

beforeEach(() => {
  resetAllFixtures();
});

afterEach(() => {
  cleanup();
});
