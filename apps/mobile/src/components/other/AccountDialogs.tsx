import { useState } from 'react';
import { Alert } from 'react-native';

import { requestAccountDeletion } from '@/fixtures/actions';
import { useSignOut } from '@/hooks/useAuth';

import { ConfirmDialog } from '../ui/ConfirmDialog';

type Pending = 'logout' | 'delete' | null;

/** OTH-08: logout and account deletion always ask first. Returns triggers plus the dialogs. */
export function useAccountDialogs() {
  const signOut = useSignOut();
  const [pending, setPending] = useState<Pending>(null);

  const runDeletion = () =>
    requestAccountDeletion().catch((error: unknown) => {
      console.error('other: account deletion request failed', error);
      Alert.alert('탈퇴 요청에 실패했어요', '잠시 후 다시 시도해 주세요.');
    });

  const dialogs = (
    <>
      <ConfirmDialog
        visible={pending === 'logout'}
        title="로그아웃할까요?"
        message="다시 이용하려면 소셜 계정으로 로그인해야 해요."
        confirmLabel="로그아웃"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          setPending(null);
          signOut.mutate();
        }}
      />
      <ConfirmDialog
        visible={pending === 'delete'}
        title="회원 탈퇴"
        message="탈퇴하면 정책에 따라 계정과 개인정보가 처리돼요. 정말 계속할까요?"
        confirmLabel="탈퇴하기"
        destructive
        onCancel={() => setPending(null)}
        onConfirm={() => {
          setPending(null);
          void runDeletion();
        }}
      />
    </>
  );

  return {
    dialogs,
    askLogout: () => setPending('logout'),
    askDeletion: () => setPending('delete'),
  };
}
