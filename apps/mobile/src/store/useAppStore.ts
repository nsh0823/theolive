import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ColorMode = 'light' | 'dark' | 'system';

type AppState = {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      colorMode: 'system',
      setColorMode: (colorMode) => set({ colorMode }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
