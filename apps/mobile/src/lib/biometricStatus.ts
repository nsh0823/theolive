import { BIOMETRIC_STATUS, type BiometricStatus } from '@/models';

import { successState, type QueryState } from './queryState';

/**
 * Stub: the real value comes from the device (expo-local-authentication) once that dependency is approved.
 * Biometric lock stays a local UI setting; nothing here talks to the backend.
 */
export const useBiometricStatusQuery = (): QueryState<BiometricStatus> =>
  successState(BIOMETRIC_STATUS.AVAILABLE);
