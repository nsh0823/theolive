import { signOut, type Session } from '@theolive/api';
import { APP_ERROR, type AppErrorCode } from '@theolive/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { classifySession, SESSION_VERDICT } from '@/lib/customerSession';
import { supabase } from '@/services/supabase';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  /** Set when a sign-in was refused (e.g. a staff account); cleared by the sign-in screen. */
  rejection: AppErrorCode | null;
  clearRejection: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  rejection: null,
  clearRejection: () => undefined,
});

type RawSession = { isLoaded: boolean; session: Session | null };
/** Result of checking one raw session: `session` is that session, or null when it was rejected. */
type Verified = { source: Session; session: Session | null };

export function AuthProvider({ children }: PropsWithChildren) {
  const [raw, setRaw] = useState<RawSession>({ isLoaded: false, session: null });
  const [verified, setVerified] = useState<Verified | null>(null);
  const [rejection, setRejection] = useState<AppErrorCode | null>(null);

  useEffect(() => {
    let isActive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isActive) setRaw({ isLoaded: true, session: data.session });
      })
      .catch((error: unknown) => {
        console.error('Failed to read the auth session', error);
        if (isActive) setRaw({ isLoaded: true, session: null });
      });
    // Only store the session here: awaiting Supabase calls inside this callback can deadlock the client.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setRaw({ isLoaded: true, session: nextSession });
    });
    return () => {
      isActive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const session = raw.session;
    if (!session) return;
    let isActive = true;
    void (async () => {
      const verdict = await classifySession(supabase);
      if (!isActive) return;
      if (verdict !== SESSION_VERDICT.STAFF_REJECTED) {
        setVerified({ source: session, session });
        return;
      }
      setRejection(APP_ERROR.STAFF_ACCOUNT_NOT_ALLOWED);
      try {
        await signOut(supabase);
      } catch (error) {
        console.error('Sign-out after rejecting a staff account failed', error);
      }
      if (isActive) setVerified({ source: session, session: null });
    })();
    return () => {
      isActive = false;
    };
  }, [raw]);

  const clearRejection = useCallback(() => setRejection(null), []);
  const isVerifyingSession = raw.session !== null && verified?.source !== raw.session;
  const value = useMemo(
    () => ({
      session: raw.session !== null && verified?.source === raw.session ? verified.session : null,
      isLoading: !raw.isLoaded || isVerifyingSession,
      rejection,
      clearRejection,
    }),
    [raw, verified, isVerifyingSession, rejection, clearRejection],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
