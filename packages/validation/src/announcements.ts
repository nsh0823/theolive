import { z } from 'zod';

import { ANNOUNCEMENT_BODY_MAX_LENGTH, ANNOUNCEMENT_TITLE_MAX_LENGTH } from './limits';

export const announcementStatusSchema = z.enum(['PUBLISHED', 'UNPUBLISHED']);

/** Store Admin notice form (`announcements`). The server stamps `published_at`; the form never sends it. */
export const announcementSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, '제목을 입력해 주세요.')
    .max(
      ANNOUNCEMENT_TITLE_MAX_LENGTH,
      `제목은 ${ANNOUNCEMENT_TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`,
    ),
  body: z
    .string()
    .trim()
    .min(1, '내용을 입력해 주세요.')
    .max(
      ANNOUNCEMENT_BODY_MAX_LENGTH,
      `내용은 ${ANNOUNCEMENT_BODY_MAX_LENGTH}자 이하로 입력해 주세요.`,
    ),
  status: announcementStatusSchema,
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
