import { useState } from 'react';
import {
  NOTICE_BODY_MAX_LENGTH,
  NOTICE_TITLE_MAX_LENGTH,
  validateNotice,
  type NoticeFormErrors,
} from '@/domain/notice';
import { NOTICE_STATUS_LABEL } from '@/domain/labels';
import { NOTICE_STATUS, type Notice, type NoticeStatus } from '@/domain/models';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextAreaField, TextField } from '@/ui/Fields';

export function NoticeFormDialog({
  target,
  onClose,
  onSave,
}: {
  target: Notice | 'new';
  onClose: () => void;
  onSave: (title: string, body: string, status: NoticeStatus, existing: Notice | null) => void;
}) {
  const existing = target === 'new' ? null : target;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [status, setStatus] = useState<NoticeStatus>(existing?.status ?? NOTICE_STATUS.UNPUBLISHED);
  const [errors, setErrors] = useState<NoticeFormErrors>({});

  function submit(): void {
    const found = validateNotice(title, body);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave(title.trim(), body.trim(), status, existing);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? '공지 수정' : '공지 작성'}
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>저장</Button>
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
          label="제목"
          data-autofocus
          maxLength={NOTICE_TITLE_MAX_LENGTH}
          value={title}
          error={errors.title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextAreaField
          label="내용"
          maxLength={NOTICE_BODY_MAX_LENGTH}
          className="min-h-40"
          value={body}
          error={errors.body}
          onChange={(e) => setBody(e.target.value)}
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">게시 상태</legend>
          <div className="flex gap-2">
            {Object.values(NOTICE_STATUS).map((value) => (
              <label
                key={value}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
              >
                <input
                  type="radio"
                  name="notice-status"
                  className="accent-primary"
                  checked={status === value}
                  onChange={() => setStatus(value)}
                />
                {NOTICE_STATUS_LABEL[value]}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
