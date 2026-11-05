import { signInWithEmail } from '@theolive/api';
import { signInSchema } from '@theolive/validation';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/Fields';
import { ROUTES } from '@/lib/routes';
import { AuthShell } from './AuthShell';
import { AUTH_STATUS } from './accessRules';
import { useAuth, useSupabase } from './AuthContext';

const SIGN_IN_FAILED = '이메일 또는 비밀번호를 확인해 주세요.';

function readFrom(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from: unknown = state.from;
    if (typeof from === 'string' && from.startsWith('/')) return from;
  }
  return ROUTES.ORDERS;
}

/** Staff sign-in with email and password (OQ-4). Invited staff set their password through the invite link. */
export function LoginPage() {
  const client = useSupabase();
  const { state } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (state.status === AUTH_STATUS.SIGNED_IN) {
    return <Navigate to={readFrom(location.state)} replace />;
  }

  async function submit(): Promise<void> {
    if (isSubmitting) return;
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? SIGN_IN_FAILED);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmail(client, parsed.data);
    } catch (caught) {
      console.error('Staff sign-in failed', caught);
      setError(SIGN_IN_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="직원 로그인">
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="이메일"
          type="email"
          autoComplete="username"
          data-autofocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          value={password}
          error={error}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '로그인 중…' : '로그인'}
        </Button>
      </form>
    </AuthShell>
  );
}
