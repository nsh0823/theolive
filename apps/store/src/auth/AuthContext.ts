import type { TypedSupabaseClient } from '@theolive/api';
import { createContext, useContext } from 'react';
import { AUTH_STATUS, type AuthState } from './accessRules';

export type AuthContextValue = {
  state: AuthState;
  signOut: () => Promise<void>;
  retry: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
export const SupabaseContext = createContext<TypedSupabaseClient | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function useSupabase(): TypedSupabaseClient {
  const client = useContext(SupabaseContext);
  if (!client) throw new Error('useSupabase must be used inside SupabaseContext');
  return client;
}

/** The signed-in staff user, or throws: use only below `RequireAccess`. */
export function useSignedInUser() {
  const { state } = useAuth();
  if (state.status !== AUTH_STATUS.SIGNED_IN) {
    throw new Error('useSignedInUser must be used below RequireAccess');
  }
  return state;
}
