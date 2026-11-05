import type { ReactNode } from 'react';
import { Button, BUTTON_VARIANT } from './Button';
import { Dialog } from './Dialog';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  isDestructive = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onCancel}>
            취소
          </Button>
          <Button
            variant={isDestructive ? BUTTON_VARIANT.DANGER : BUTTON_VARIANT.PRIMARY}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
