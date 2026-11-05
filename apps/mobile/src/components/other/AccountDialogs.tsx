import { toAppErrorCode, APP_ERROR_MESSAGE } from '@theolive/types';
import { useState } from 'react';

import { useDeleteAccountMutation } from '@/hooks/useAccount';
import { useSignOut } from '@/hooks/useAuth';
import { useCartStore } from '@/store/useCartStore';
import { useCheckoutAttemptStore } from '@/store/useCheckoutAttemptStore';

import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NicknameDialog } from './NicknameDialog';

type Pending = 'logout' | 'delete' | 'nickname' | null;

/** OTH-08: logout and account deletion always ask first. Returns triggers plus the dialogs. */
export function useAccountDialogs() {
  const signOut = useSignOut();
  const deletion = useDeleteAccountMutation();
  const [pending, setPending] = useState<Pending>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const runDeletion = () => {
    // A second tap while the request is running must not send a second one.
    if (deletion.isPending) return;
    deletion.mutate(undefined, {
      onSuccess: () => {
        // The server ended the session; the auth gate shows the sign-in screen. Member data leaves the device.
        useCartStore.getState().clear();
        useCheckoutAttemptStore.getState().reset();
        setPending(null);
      },
      onError: (error) => {
        console.error('other: account deletion failed', error);
        setPending(null);
        setFailure(APP_ERROR_MESSAGE[toAppErrorCode(error)]);
      },
    });
  };

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
        message="탈퇴하면 보유한 스탬프와 쿠폰 포인트가 사라지고 쿠폰은 사용할 수 없어요. 개인정보는 삭제되며, 주문과 결제 기록은 법령에 따라 보관돼요. 정말 계속할까요?"
        confirmLabel={deletion.isPending ? '처리 중' : '탈퇴하기'}
        destructive
        onCancel={() => {
          if (!deletion.isPending) setPending(null);
        }}
        onConfirm={runDeletion}
      />
      <ConfirmDialog
        visible={failure !== null}
        title="탈퇴할 수 없어요"
        message={failure ?? undefined}
        confirmLabel="확인"
        cancelLabel="닫기"
        onCancel={() => setFailure(null)}
        onConfirm={() => setFailure(null)}
      />
      <NicknameDialog visible={pending === 'nickname'} onClose={() => setPending(null)} />
    </>
  );

  return {
    dialogs,
    askLogout: () => setPending('logout'),
    askDeletion: () => setPending('delete'),
    askNickname: () => setPending('nickname'),
  };
}
