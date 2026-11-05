import {
  signOut as signOutUser,
  useProfile,
  useStaffAccess,
  type Session,
  type TypedSupabaseClient,
} from '@theolive/api';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AUTH_STATUS, type AuthState } from './accessRules';
import { AuthContext, SupabaseContext, type AuthContextValue } from './AuthContext';

type SessionState = { isLoaded: boolean; session: Session | null };

/** Session from Supabase Auth plus the staff role read from the database (never from the JWT). */
export function AuthProvider({
  client,
  children,
}: {
  client: TypedSupabaseClient;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [sessionState, setSessionState] = useState<SessionState>({
    isLoaded: false,
    session: null,
  });

  useEffect(() => {
    let isActive = true;
    client.auth
      .getSession()
      .then(({ data }) => {
        if (isActive) setSessionState({ isLoaded: true, session: data.session });
      })
      .catch((error: unknown) => {
        console.error('Failed to read the auth session', error);
        if (isActive) setSessionState({ isLoaded: true, session: null });
      });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setSessionState({ isLoaded: true, session });
    });
    return () => {
      isActive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const userId = sessionState.session?.user.id;
  const access = useStaffAccess(client, userId);
  const profile = useProfile(client, userId);

  const signOut = useCallback(async () => {
    await signOutUser(client);
    queryClient.clear();
  }, [client, queryClient]);

  const retry = useCallback(() => {
    void access.refetch();
  }, [access]);

  const state: AuthState = useMemo(() => {
    const user = sessionState.session?.user;
    if (!sessionState.isLoaded) return { status: AUTH_STATUS.LOADING };
    if (!user) return { status: AUTH_STATUS.SIGNED_OUT };
    if (access.isError) return { status: AUTH_STATUS.ERROR };
    if (access.isPending) return { status: AUTH_STATUS.LOADING };
    return {
      status: AUTH_STATUS.SIGNED_IN,
      userId: user.id,
      email: user.email ?? null,
      displayName: profile.data?.nickname ?? user.email ?? '',
      access: access.data,
    };
  }, [sessionState, access.isError, access.isPending, access.data, profile.data]);

  const value: AuthContextValue = useMemo(
    () => ({ state, signOut, retry }),
    [state, signOut, retry],
  );

  return (
    <SupabaseContext.Provider value={client}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </SupabaseContext.Provider>
  );
}
