import { MENU_IMAGE_MAX_BYTES, MENU_IMAGE_TYPES } from '@theolive/api';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, BUTTON_VARIANT } from '@/ui/Button';
import { Thumbnail } from '@/ui/Thumbnail';

const MAX_MB = MENU_IMAGE_MAX_BYTES / (1024 * 1024);
const ACCEPT = Object.keys(MENU_IMAGE_TYPES).join(',');

export type MenuImageChange = { file: File | null; isRemoved: boolean };

type MenuImageFieldProps = {
  /** Public URL of the image the item has now. */
  currentUrl: string | null;
  onChange: (change: MenuImageChange) => void;
};

/** Picks a replacement photo (jpeg/png/webp, up to 2 MB) or marks the current one for removal. Nothing uploads until save. */
export function MenuImageField({ currentUrl, onChange }: MenuImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRemoved, setIsRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function choose(file: File | undefined): void {
    if (!file) return;
    if (!(file.type in MENU_IMAGE_TYPES)) {
      setError('JPG, PNG, WEBP 이미지만 올릴 수 있어요.');
      return;
    }
    if (file.size > MENU_IMAGE_MAX_BYTES) {
      setError(`이미지는 ${MAX_MB}MB 이하만 올릴 수 있어요.`);
      return;
    }
    setError(null);
    setIsRemoved(false);
    setPreviewUrl(URL.createObjectURL(file));
    onChange({ file, isRemoved: false });
  }

  function remove(): void {
    setError(null);
    setPreviewUrl(null);
    setIsRemoved(true);
    if (inputRef.current) inputRef.current.value = '';
    onChange({ file: null, isRemoved: true });
  }

  const shownUrl = isRemoved ? null : (previewUrl ?? currentUrl);

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">메뉴 이미지</legend>
      <div className="flex items-center gap-3">
        <Thumbnail imageUrl={shownUrl} className="size-16" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant={BUTTON_VARIANT.OUTLINE}
            icon={<ImagePlus className="size-4" aria-hidden="true" />}
            onClick={() => inputRef.current?.click()}
          >
            {shownUrl ? '이미지 변경' : '이미지 선택'}
          </Button>
          {shownUrl ? (
            <Button
              variant={BUTTON_VARIANT.GHOST}
              icon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={remove}
            >
              이미지 제거
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="메뉴 이미지 파일"
          tabIndex={-1}
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG, WEBP · {MAX_MB}MB 이하</p>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
