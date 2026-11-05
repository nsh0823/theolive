import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/ui/Fields';
import { Switch } from '@/ui/Switch';
import { cn } from '@/lib/cn';
import {
  MENU_DESCRIPTION_MAX_LENGTH,
  MENU_NAME_MAX_LENGTH,
  MENU_TEMPERATURE_CHOICES,
  validateMenuForm,
  initialMenuFormValues,
  type MenuFormFields,
  type MenuFormErrors,
} from '@/domain/menuForm';
import type { MenuCategory, MenuItem, Temperature } from '@/domain/models';

type MenuFormDialogProps = {
  /** `null` closes the dialog; an item edits; `'new'` creates. */
  target: MenuItem | 'new' | null;
  categories: MenuCategory[];
  onClose: () => void;
  onSave: (fields: MenuFormFields, existing: MenuItem | null) => void;
};

/** The dialog body is remounted per target (via `key`) so form state always starts fresh. */
function MenuForm({
  target,
  categories,
  onClose,
  onSave,
}: Omit<MenuFormDialogProps, 'target'> & { target: MenuItem | 'new' }) {
  const [values, setValues] = useState(() => initialMenuFormValues(target, categories));
  const [errors, setErrors] = useState<MenuFormErrors>({});
  const existing = target === 'new' ? null : target;

  function toggleTemperature(temperature: Temperature): void {
    setValues((previous) => ({
      ...previous,
      temperatures: previous.temperatures.includes(temperature)
        ? previous.temperatures.filter((value) => value !== temperature)
        : [...previous.temperatures, temperature],
    }));
  }

  function submit(): void {
    const result = validateMenuForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSave(result.fields, existing);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? '메뉴 수정' : '메뉴 추가'}
      description="메뉴 옵션은 HOT / ICE만 설정할 수 있어요."
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant={BUTTON_VARIANT.OUTLINE} onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>{existing ? '저장' : '추가'}</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
      >
        <div className="flex gap-4 max-sm:flex-col">
          <TextField
            label="메뉴 이름"
            data-autofocus
            maxLength={MENU_NAME_MAX_LENGTH}
            value={values.name}
            error={errors.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            wrapperClassName="flex-1"
          />
          <TextField
            label="가격 (원)"
            inputMode="numeric"
            value={values.priceText}
            error={errors.price}
            onChange={(e) => setValues({ ...values, priceText: e.target.value })}
            wrapperClassName="sm:w-40"
          />
        </div>
        <SelectField
          label="카테고리"
          value={values.categoryId}
          error={errors.category}
          onChange={(e) => setValues({ ...values, categoryId: e.target.value })}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="설명"
          maxLength={MENU_DESCRIPTION_MAX_LENGTH}
          value={values.description}
          error={errors.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">온도 옵션 (HOT / ICE)</legend>
          <div className="flex gap-2">
            {MENU_TEMPERATURE_CHOICES.map((temperature) => {
              const selected = values.temperatures.includes(temperature);
              return (
                <label
                  key={temperature}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                    selected
                      ? 'border-primary bg-secondary text-secondary-foreground'
                      : 'border-border',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected}
                    onChange={() => toggleTemperature(temperature)}
                  />
                  {selected ? <Check className="size-4" aria-hidden="true" /> : null}
                  {temperature}
                </label>
              );
            })}
          </div>
          {errors.temperatures ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
              {errors.temperatures}
            </p>
          ) : null}
        </fieldset>
        <div className="flex items-center justify-between rounded-xl border border-border px-4">
          <div className="py-2">
            <p className="text-sm font-semibold">고객에게 노출</p>
            <p className="text-xs text-muted-foreground">
              끄면 고객 메뉴에서 숨겨져요 (판매 중지).
            </p>
          </div>
          <Switch
            checked={values.isActive}
            onChange={(isActive) => setValues({ ...values, isActive })}
            label="고객에게 노출"
          />
        </div>
      </form>
    </Dialog>
  );
}

export function MenuFormDialog(props: MenuFormDialogProps) {
  if (props.target === null) return null;
  return (
    <MenuForm
      key={props.target === 'new' ? 'new' : props.target.id}
      {...props}
      target={props.target}
    />
  );
}
