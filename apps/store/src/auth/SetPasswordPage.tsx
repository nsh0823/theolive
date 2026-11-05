import { setPassword } from '@theolive/api';
import { signInSchema } from '@theolive/validation';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/Fields';
import { AUTH_ROUTES, ROUTES } from '@/lib/routes';
import { AuthShell } from './AuthShell';
import { AUTH_STATUS } from './accessRules';
import { useAuth, useSupabase } from './AuthContext';

const PASSWORD_MISMATCH = '비밀번호가 서로 달라요.';
const SAVE_FAILED = '비밀번호를 저장하지 못했어요. 초대 링크를 다시 열어 주세요.';
const passwordSchema = signInSchema.shape.password;

/** Landing page for the staff invite link: the link signs the user in, then they choose a password. */
export function SetPasswordPage() {
  const client = useSupabase();
  const { state } = useAuth();
  const [password, setPasswordValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (state.status === AUTH_STATUS.LOADING) return null;
  if (state.status === AUTH_STATUS.SIGNED_OUT) return <Navigate to={AUTH_ROUTES.LOGIN} replace />;
  if (isDone) return <Navigate to={ROUTES.ORDERS} replace />;

  async function submit(): Promise<void> {
    if (isSaving) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? SAVE_FAILED);
      return;
    }
    if (password !== confirmation) {
      setError(PASSWORD_MISMATCH);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await setPassword(client, parsed.data);
      setIsDone(true);
    } catch (caught) {
      console.error('Setting the staff password failed', caught);
      setError(SAVE_FAILED);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthShell title="비밀번호 설정">
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          data-autofocus
          value={password}
          onChange={(event) => setPasswordValue(event.target.value)}
        />
        <TextField
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          error={error}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button type="submit" disabled={isSaving}>
          {isSaving ? '저장 중…' : '비밀번호 저장'}
        </Button>
      </form>
    </AuthShell>
  );
}
