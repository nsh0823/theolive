export const NOTICE_TITLE_MAX_LENGTH = 40;
export const NOTICE_BODY_MAX_LENGTH = 500;

export type NoticeFormErrors = Partial<Record<'title' | 'body', string>>;

export function validateNotice(title: string, body: string): NoticeFormErrors {
  const errors: NoticeFormErrors = {};
  if (title.trim() === '') errors.title = '제목을 입력해 주세요.';
  else if (title.length > NOTICE_TITLE_MAX_LENGTH)
    errors.title = `제목은 ${NOTICE_TITLE_MAX_LENGTH}자 이내로 입력해 주세요.`;
  if (body.trim() === '') errors.body = '내용을 입력해 주세요.';
  else if (body.length > NOTICE_BODY_MAX_LENGTH)
    errors.body = `내용은 ${NOTICE_BODY_MAX_LENGTH}자 이내로 입력해 주세요.`;
  return errors;
}
