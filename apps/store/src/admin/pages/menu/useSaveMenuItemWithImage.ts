import { removeMenuImage, useSaveMenuItem, useUploadMenuImage } from '@theolive/api';
import { useSupabase } from '@/auth/AuthContext';
import { describeError } from '@/lib/errorMessage';
import { useToast } from '@/ui/Toast';
import type { MenuFormFields } from '@/domain/menuForm';
import type { MenuItem } from '@/domain/models';
import type { MenuImageChange } from './MenuImageField';

/**
 * Saves a menu item with its photo: upload first, then save the row, then remove the replaced photo.
 * If the save fails the new upload is removed, so no orphaned files pile up. Resolves true on success.
 */
export function useSaveMenuItemWithImage() {
  const client = useSupabase();
  const saveItem = useSaveMenuItem(client);
  const uploadImage = useUploadMenuImage(client);
  const { notify } = useToast();

  async function save(
    fields: MenuFormFields,
    existing: MenuItem | null,
    image: MenuImageChange,
  ): Promise<boolean> {
    let uploadedPath: string | null = null;
    try {
      let imagePath = image.isRemoved ? null : (existing?.imagePath ?? null);
      if (image.file) {
        uploadedPath = await uploadImage.mutateAsync(image.file);
        imagePath = uploadedPath;
      }
      await saveItem.mutateAsync({ id: existing?.id ?? null, fields: { ...fields, imagePath } });
      if (existing?.imagePath && existing.imagePath !== imagePath) {
        await removeMenuImage(client, existing.imagePath);
      }
      notify(existing ? `${fields.name} 메뉴를 수정했어요` : `${fields.name} 메뉴를 추가했어요`);
      return true;
    } catch (error) {
      if (uploadedPath) await removeMenuImage(client, uploadedPath);
      notify(describeError(error));
      return false;
    }
  }

  return { save, isSaving: saveItem.isPending || uploadImage.isPending };
}
