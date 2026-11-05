import { act } from '@testing-library/react-native';

import { useAppStore } from '@/store/useAppStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('useAppStore', () => {
  it('defaults to the system color mode', () => {
    expect(useAppStore.getState().colorMode).toBe('system');
  });

  it('updates the color mode', () => {
    act(() => useAppStore.getState().setColorMode('dark'));
    expect(useAppStore.getState().colorMode).toBe('dark');
  });
});
