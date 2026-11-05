import { staffInviteSchema, STAFF_NAME_MAX_LENGTH } from '@theolive/validation';
import { useState } from 'react';
import { STAFF_PERMISSION_LABEL } from '@/domain/labels';
import { STAFF_PERMISSION, type StaffPermission } from '@/domain/models';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Fields';

export type StaffFormValues = { name: string; email: string; permissions: StaffPermission[] };

type StaffFormTarget = { name: string; email: string; permissions: readonly StaffPermission[] };

type StaffFormDialogProps = {
  /** `null` = invite a new staff member. */
  existing: StaffFormTarget | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: StaffFormValues) => void;
};

export function StaffFormDialog({ existing, isSaving, onClose, onSave }: StaffFormDialogProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [permissions, setPermissions] = useState<StaffPermission[]>(
    existing ? [...existing.permissions] : [STAFF_PERMISSION.PROCESS_ORDERS],
  );
  const [errors, setErrors] = useState<{ name?: string; email?: string; permissions?: string }>({});

  function submit(): void {
    if (isSaving) return;
    const parsed = staffInviteSchema.safeParse({
      email,
      displayName: name,
      role: 'STAFF',
      permissions,
    });
    const next: { name?: string; email?: string; permissions?: string } = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'displayName') next.name ??= issue.message;
        if (field === 'email') next.email ??= issue.message;
        if (field === 'permissions') next.permissions ??= issue.message;
      }
    }
    setErrors(next);
    if (!parsed.success) return;
    onSave({
      name: parsed.data.displayName,
      email: parsed.data.email,
      permissions: parsed.data.permissions,
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? '직원 정보 수정' : '직원 추가'}
      description={existing ? undefined : '입력한 이메일로 초대 링크가 전송돼요.'}
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit} disabled={isSaving}>
            {existing ? '저장' : '초대하기'}
          </Button>
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
          maxLength={STAFF_NAME_MAX_LENGTH}
          value={name}
          error={errors.name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="이메일"
          type="email"
          value={email}
          disabled={existing !== null}
          hint={existing ? '이메일은 변경할 수 없어요.' : undefined}
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
          {errors.permissions ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
              {errors.permissions}
            </p>
          ) : null}
        </fieldset>
      </form>
    </Dialog>
  );
}
