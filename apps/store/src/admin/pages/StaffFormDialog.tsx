import { useState } from 'react';
import { nextId } from '@/data/actions';
import { STAFF_PERMISSION_LABEL } from '@/domain/labels';
import { STAFF_PERMISSION, type StaffMember, type StaffPermission } from '@/domain/models';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Fields';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX_LENGTH = 20;

export function StaffFormDialog({
  target,
  onClose,
  onSave,
}: {
  target: StaffMember | 'new';
  onClose: () => void;
  onSave: (member: StaffMember) => void;
}) {
  const existing = target === 'new' ? null : target;
  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [permissions, setPermissions] = useState<StaffPermission[]>(
    existing?.permissions ?? [STAFF_PERMISSION.PROCESS_ORDERS],
  );
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function submit(): void {
    const next: { name?: string; email?: string } = {};
    if (name.trim() === '') next.name = '이름을 입력해 주세요.';
    if (!EMAIL_PATTERN.test(email.trim())) next.email = '올바른 이메일 주소를 입력해 주세요.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSave({
      id: existing?.id ?? nextId('staff'),
      name: name.trim(),
      email: email.trim(),
      isActive: existing?.isActive ?? true,
      permissions,
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? '직원 정보 수정' : '직원 추가'}
      description={
        existing
          ? undefined
          : '입력한 이메일로 초대 링크가 전송돼요 (인증 연동 전에는 화면만 확인할 수 있어요).'
      }
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>{existing ? '저장' : '초대하기'}</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          label="이름"
          data-autofocus
          maxLength={NAME_MAX_LENGTH}
          value={name}
          error={errors.name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="이메일"
          type="email"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">권한</legend>
          <div className="flex flex-col gap-2">
            {Object.values(STAFF_PERMISSION).map((permission) => (
              <label
                key={permission}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={permissions.includes(permission)}
                  onChange={(e) =>
                    setPermissions((prev) =>
                      e.target.checked
                        ? [...prev, permission]
                        : prev.filter((p) => p !== permission),
                    )
                  }
                />
                {STAFF_PERMISSION_LABEL[permission]}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
