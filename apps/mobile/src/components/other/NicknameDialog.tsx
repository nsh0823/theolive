import { Input, InputField } from '@theolive/ui/components/input';
import { Text } from '@theolive/ui/components/text';
import { nicknameSchema } from '@theolive/validation';
import { useState } from 'react';

import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { useUpdateNicknameMutation } from '@/hooks/useProfileQuery';

import { ConfirmDialog } from '../ui/ConfirmDialog';

const SAVE_FAILED_MESSAGE = '닉네임을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.';

type Props = { visible: boolean; onClose: () => void };

/** Changes the nickname. The same rule (1-20 characters) is enforced again by the database. */
export function NicknameDialog({ visible, onClose }: Props) {
  const current = useCurrentProfile().data?.nickname ?? '';
  const update = useUpdateNicknameMutation();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = draft ?? current;

  const close = () => {
    setDraft(null);
    setError(null);
    onClose();
  };

  const save = () => {
    if (update.isPending) return;
    const parsed = nicknameSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? SAVE_FAILED_MESSAGE);
      return;
    }
    setError(null);
    update.mutate(parsed.data, {
      onSuccess: close,
      onError: () => setError(SAVE_FAILED_MESSAGE),
    });
  };

  return (
    <ConfirmDialog
      visible={visible}
      title="닉네임 변경"
      confirmLabel={update.isPending ? '저장 중' : '저장'}
      onCancel={close}
      onConfirm={save}
    >
      <Input className="min-h-12 rounded-md bg-card">
        <InputField
          value={value}
          onChangeText={(text) => {
            setDraft(text);
            setError(null);
          }}
          aria-label="닉네임"
          autoCapitalize="none"
        />
      </Input>
      {error ? (
        <Text size="sm" className="text-destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </ConfirmDialog>
  );
}
