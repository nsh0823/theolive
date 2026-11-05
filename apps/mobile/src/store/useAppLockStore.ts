import { create } from 'zustand';

type AppLockState = {
  hasPassword: boolean;
  lockEnabled: boolean;
  biometricEnabled: boolean;
  /** UI stub: records only that a password exists. The real PIN must be stored hashed in SecureStore. */
  markPasswordSet: () => void;
  setLockEnabled: (enabled: boolean) => void;
  setBiometricEnabled: (enabled: boolean) => void;
};

/** In-memory placeholder for AUTH-05; nothing here secures the app yet. */
export const useAppLockStore = create<AppLockState>()((set) => ({
  hasPassword: false,
  lockEnabled: false,
  biometricEnabled: false,
  markPasswordSet: () => set({ hasPassword: true, lockEnabled: true }),
  setLockEnabled: (lockEnabled) =>
    set((state) => ({
      lockEnabled,
      biometricEnabled: lockEnabled ? state.biometricEnabled : false,
    })),
  setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
}));
