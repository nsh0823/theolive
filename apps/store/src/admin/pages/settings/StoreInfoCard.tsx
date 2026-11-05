import { useSaveStoreInfo } from '@theolive/api';
import { storeInfoSchema } from '@theolive/validation';
import { useState } from 'react';
import { Store } from 'lucide-react';
import { useSupabase } from '@/auth/AuthContext';
import { describeError } from '@/lib/errorMessage';
import type { StoreInfo } from '@/domain/models';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { TextAreaField, TextField } from '@/ui/Fields';
import { useToast } from '@/ui/Toast';

export function StoreInfoCard({ info }: { info: StoreInfo }) {
  const [draft, setDraft] = useState(info);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();
  const saveInfo = useSaveStoreInfo(useSupabase());

  function save(): void {
    const parsed = storeInfoSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력한 내용을 확인해 주세요.');
      return;
    }
    setError(null);
    saveInfo.mutate(parsed.data, {
      onSuccess: () => notify('매장 정보를 저장했어요'),
      onError: (failure) => notify(describeError(failure)),
    });
  }

  return (
    <Card>
      <CardHeader icon={<Store className="size-5" />} title="매장 정보" />
      <CardBody>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <TextField
            label="매장 이름"
            value={draft.name}
            error={error}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <TextField
            label="전화번호"
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
          <TextField
            label="주소"
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
          />
          <TextAreaField
            label="매장 소개"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <div>
            <Button type="submit" disabled={saveInfo.isPending}>
              저장
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
